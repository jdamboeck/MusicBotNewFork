const { spawn } = require("child_process");
const { fetchPoToken, PoTokenCache } = require("./po-token-provider");
const path = require("path");
const { BaseExtractor } = require("discord-player");

// Initialize PO token cache
const poTokenCache = new PoTokenCache(6); // 6 hour TTL

// Path to yt-dlp executable
// Using platform-independent zipimport binary for Linux/Docker
const YTDLP_PATH = path.join(__dirname, "yt-dlp"); // Use local yt-dlp binary
// Alternative: const YTDLP_PATH = "yt-dlp"; // Use system PATH

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

		const args = ["-o", "-", "-f", "bestaudio", "--no-playlist"];

		// Add PO token if available
		if (poToken) {
			args.push("--extractor-args", `youtube:po_token=web.gvs+${poToken}`);
			console.log("[yt-dlp] Using PO token for stream");
		}

		args.push(info.url);

		// Spawn yt-dlp to output the raw audio stream to stdout
		const process = spawn(YTDLP_PATH, args, { stdio: ["ignore", "pipe", "ignore"] });

		return process.stdout; // This is a Readable Stream that Discord can play
	}
}

module.exports = { YtDlpExtractor };
