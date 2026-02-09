/**
 * Resolves yt-dlp executable: system PATH (if available) → project-root binary only.
 * Used by ytdlp-extractor and ensure-yt-dlp.js (for consistent path logic).
 */

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.join(__dirname);
const localBinary = path.join(projectRoot, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

function getYtDlpPath() {
	// 1. System-installed (PATH)
	try {
		const r = spawnSync("yt-dlp", ["--version"], { encoding: "utf8", stdio: "pipe" });
		if (r.status === 0) return "yt-dlp";
	} catch {
		// not in PATH
	}
	// 2. Project folder binary (ensure-yt-dlp.js)
	try {
		fs.accessSync(localBinary, fs.constants.X_OK);
		return localBinary;
	} catch {
		// not present or not executable
	}
	return "yt-dlp";
}

const YTDLP_PATH = getYtDlpPath();

function getJsRuntimeArgs() {
	return ["--js-runtimes", `node:${process.execPath}`];
}

module.exports = { getYtDlpPath, getJsRuntimeArgs, YTDLP_PATH };
