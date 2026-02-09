const { spawn, spawnSync } = require("child_process");
const { fetchPoToken, PoTokenCache } = require("./po-token-provider");
const path = require("path");
const fs = require("fs");
const { BaseExtractor } = require("discord-player");

// Initialize PO token cache
const poTokenCache = new PoTokenCache(6); // 6 hour TTL

// Resolve yt-dlp executable: system PATH (if available) → project binary → node_modules
const projectRoot = __dirname;
const localBinary = path.join(projectRoot, "yt-dlp");
const nodeModulesBinPaths = [
	path.join(projectRoot, "node_modules", "youtube-dl-exec", "bin", "yt-dlp"),
	path.join(projectRoot, "node_modules", "youtube-dl-exec", "bin", "youtube-dl"),
];

function getYtDlpPath() {
	// 1. System-installed (PATH) - prefer so we get a recent yt-dlp that supports --js-runtimes
	try {
		const r = spawnSync("yt-dlp", ["--version"], { encoding: "utf8", stdio: "pipe" });
		if (r.status === 0) return "yt-dlp";
	} catch {
		// not in PATH
	}
	// 2. Project folder binary (must be executable)
	try {
		fs.accessSync(localBinary, fs.constants.X_OK);
		return localBinary;
	} catch {
		// not present or not executable
	}
	// 3. node_modules (e.g. youtube-dl-exec)
	for (const binPath of nodeModulesBinPaths) {
		try {
			fs.accessSync(binPath, fs.constants.X_OK);
			return binPath;
		} catch {
			// skip
		}
	}
	return "yt-dlp";
}
const YTDLP_PATH = getYtDlpPath();

// Only pass --js-runtimes when using system yt-dlp; bundled (e.g. youtube-dl-exec) may not support it
function getJsRuntimeArgs() {
	if (YTDLP_PATH !== "yt-dlp") return [];
	return ["--js-runtimes", `node:${process.execPath}`];
}

class YtDlpExtractor extends BaseExtractor {
	static identifier = "com.custom.yt-dlp";

	constructor() {
		super();
	}

	async validate(query) {
		// We only want to handle YouTube links or searches
		const isYouTube = query.includes("youtube.com") || query.includes("youtu.be");
		const isSearchQuery = !query.startsWith("http");
		const shouldHandle = isYouTube || isSearchQuery;
		console.log(`[yt-dlp] Validate "${query}": ${shouldHandle ? "YES" : "NO"} (isYT: ${isYouTube}, isSearch: ${isSearchQuery})`);
		return shouldHandle;
	}

	async handle(query, context) {
		console.log(`[yt-dlp] Processing: ${query}`);
		return new Promise((resolve, reject) => {
			// Determine if it's a direct URL or a search query
			const isUrl = query.startsWith("http");
			const args = [
				...getJsRuntimeArgs(),
				"--dump-json", // Get metadata as JSON
				"--flat-playlist", // Don't expand large playlists (speed)
				"--no-playlist", // Prefer single video if mixed
				"--default-search",
				"ytsearch", // Treat non-urls as search
				isUrl ? query : `ytsearch1:${query}`, // Limit search to 1 result
			];

			// NOTE: Make sure yt-dlp is in your PATH or current directory
			const process = spawn(YTDLP_PATH, args);

			let data = "";
			process.stdout.on("data", (chunk) => (data += chunk));

			// Log errors if any
			process.stderr.on("data", (chunk) => console.error(`[yt-dlp error] ${chunk}`));

			process.on("close", (code) => {
				if (code !== 0 || !data) {
					console.log(`[yt-dlp] Process exited with code ${code}`);
					return resolve({ tracks: [] });
				}

				try {
					// Try parsing the accumulated JSON output
					const info = JSON.parse(data);

					// Create a Track object compatible with Discord Player
					const track = {
						title: info.title,
						description: info.description,
						author: info.uploader,
						url: info.webpage_url || info.url,
						thumbnail: info.thumbnail,
						duration: info.duration * 1000, // Convert s to ms
						views: info.view_count,
						source: "youtube",
						raw: info,
					};

					resolve({ playlist: null, tracks: [track] });
				} catch (err) {
					console.error("Failed to parse yt-dlp JSON", err);
					resolve({ tracks: [] });
				}
			});
		});
	}

	async stream(info) {
		console.log(`[yt-dlp] Streaming: ${info.title} (${info.url})`);

		// Try to get PO token from cache or fetch new one
		let poToken = poTokenCache.get("gvs");
		if (!poToken) {
			console.log("[yt-dlp] Fetching new PO token...");
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
			console.log(`[yt-dlp] Using PO token for stream (token: ${tokenPreview})`);
		} else {
			console.log("[yt-dlp] No PO token available, streaming without token");
		}

		args.push(info.url);

		// Debug: log command and args (mask token in extractor-args)
		const argsForLog = args.map((a) => {
			if (a.startsWith("youtube:po_token=web.gvs+")) return "youtube:po_token=web.gvs+***";
			return a;
		});
		console.log(`[yt-dlp] Stream spawn: ${YTDLP_PATH} ${argsForLog.join(" ")}`);

		// Spawn yt-dlp to output the raw audio stream to stdout; pipe stderr for debugging
		const proc = spawn(YTDLP_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });

		proc.stderr.on("data", (chunk) => {
			const line = chunk.toString().trim();
			if (line) console.log(`[yt-dlp stream stderr] ${line}`);
		});

		proc.on("error", (err) => {
			console.error("[yt-dlp] Stream process spawn error:", err.message);
		});

		proc.on("close", (code, signal) => {
			console.log(`[yt-dlp] Stream process exited code=${code} signal=${signal || "none"} url=${info.url}`);
		});

		let firstChunk = true;
		proc.stdout.on("data", (chunk) => {
			if (firstChunk) {
				firstChunk = false;
				console.log(`[yt-dlp] Stream: first data received (${chunk.length} bytes) for ${info.title}`);
			}
		});

		return proc.stdout; // This is a Readable Stream that Discord can play
	}
}

module.exports = { YtDlpExtractor };
