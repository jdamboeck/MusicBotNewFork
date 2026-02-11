/**
 * yt-dlp extractor for discord-player.
 */

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { BaseExtractor } = require("discord-player");
const { createLogger } = require("../core/logger");
const { fetchPoToken, PoTokenCache } = require("./po-token");
const config = require("./config");

const log = createLogger("yt-dlp");

// ---- Path Resolution (inlined from ytdlp-path.js) ----

const projectRoot = path.join(__dirname, "..", "..");
const localBinary = path.join(projectRoot, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

function getYtDlpPath() {
	// 1. System-installed (PATH)
	try {
		const r = spawnSync("yt-dlp", ["--version"], { encoding: "utf8", stdio: "pipe" });
		if (r.status === 0) return "yt-dlp";
	} catch {
		// not in PATH
	}
	// 2. Project folder binary
	try {
		fs.accessSync(localBinary, fs.constants.X_OK);
		return localBinary;
	} catch {
		// not present or not executable
	}
	return "yt-dlp";
}

function getJsRuntimeArgs() {
	return ["--js-runtimes", `node:${process.execPath}`];
}

const YTDLP_PATH = getYtDlpPath();
log.info("Using yt-dlp at:", YTDLP_PATH);

// ---- Extractor ----

const poTokenCache = new PoTokenCache(config.poTokenTtlHours);

class YtDlpExtractor extends BaseExtractor {
	static identifier = "com.custom.yt-dlp";

	constructor() {
		super();
	}

	async validate(query) {
		const isYouTube = query.includes("youtube.com") || query.includes("youtu.be");
		const isSearchQuery = !query.startsWith("http");
		const shouldHandle = isYouTube || isSearchQuery;
		log.debug(`Validate "${query}": ${shouldHandle ? "YES" : "NO"} (isYT: ${isYouTube}, isSearch: ${isSearchQuery})`);
		return shouldHandle;
	}

	async handle(query, context) {
		log.info("Processing:", query);
		return new Promise((resolve, reject) => {
			const isUrl = query.startsWith("http");
			const args = [
				...getJsRuntimeArgs(),
				"--dump-json",
				"--flat-playlist",
				"--no-playlist",
				"--default-search",
				"ytsearch",
				isUrl ? query : `ytsearch1:${query}`,
			];

			const child = spawn(YTDLP_PATH, args);

			let data = "";
			child.stdout.on("data", (chunk) => (data += chunk));
			child.stderr.on("data", (chunk) => log.error("stderr:", chunk.toString()));

			child.on("close", (code) => {
				if (code !== 0 || !data) {
					log.debug(`Process exited with code ${code}`);
					return resolve({ tracks: [] });
				}

				try {
					const info = JSON.parse(data);
					const track = {
						title: info.title,
						description: info.description,
						author: info.uploader,
						url: info.webpage_url || info.url,
						thumbnail: info.thumbnail,
						duration: info.duration * 1000,
						views: info.view_count,
						source: "youtube",
						raw: info,
					};

					resolve({ playlist: null, tracks: [track] });
				} catch (err) {
					log.error("Failed to parse JSON:", err);
					resolve({ tracks: [] });
				}
			});
		});
	}

	async stream(info) {
		log.info(`Streaming: ${info.title} (${info.url})`);

		// Try to get PO token from cache or fetch new one
		let poToken = poTokenCache.get("gvs");
		if (!poToken) {
			log.info("Fetching new PO token...");
			poToken = await fetchPoToken();
			if (poToken) {
				poTokenCache.set("gvs", poToken);
			}
		}

		const args = [
			...getJsRuntimeArgs(),
			"-o", "-", "-f", "bestaudio", "--no-playlist",
		];

		// Add PO token if available
		if (poToken) {
			args.push("--extractor-args", `youtube:po_token=web.gvs+${poToken}`);
			const tokenPreview = poToken.length > 8 ? `${poToken.slice(0, 4)}...${poToken.slice(-4)}` : "***";
			log.info(`Using PO token (${tokenPreview})`);
		} else {
			log.info("No PO token available, streaming without token");
		}

		args.push(info.url);

		const argsForLog = args.map((a) =>
			a.startsWith("youtube:po_token=web.gvs+") ? "youtube:po_token=web.gvs+***" : a
		);
		log.debug(`Stream spawn: ${YTDLP_PATH} ${argsForLog.join(" ")}`);

		const proc = spawn(YTDLP_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });

		proc.stderr.on("data", (chunk) => {
			const line = chunk.toString().trim();
			if (line) log.debug("stream stderr:", line);
		});

		proc.on("error", (err) => {
			log.error("Stream process spawn error:", err.message);
		});

		proc.on("close", (code, signal) => {
			log.debug(`Stream process exited code=${code} signal=${signal || "none"}`);
		});

		let firstChunk = true;
		proc.stdout.on("data", (chunk) => {
			if (firstChunk) {
				firstChunk = false;
				log.debug(`Stream: first data received (${chunk.length} bytes)`);
			}
		});

		return proc.stdout;
	}
}

module.exports = { YtDlpExtractor, YTDLP_PATH, getJsRuntimeArgs };
