#!/usr/bin/env node
/**
 * Ensures yt-dlp is available: if not in PATH, downloads the appropriate
 * binary for the OS to the project root.
 * Linux: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
 * Windows: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
const destPath = path.join(projectRoot, binaryName);

const DOWNLOAD_URLS = {
	linux: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
	win32: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
};
const url = DOWNLOAD_URLS[process.platform] || DOWNLOAD_URLS.linux;

function inPath() {
	try {
		const cmd = isWin ? "yt-dlp.exe" : "yt-dlp";
		const r = spawnSync(cmd, ["--version"], { encoding: "utf8", stdio: "pipe" });
		return r.status === 0;
	} catch {
		return false;
	}
}

function localExistsAndExecutable() {
	try {
		fs.accessSync(destPath, fs.constants.X_OK);
		return true;
	} catch {
		try {
			fs.accessSync(destPath, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}
}

async function download(downloadUrl) {
	const res = await fetch(downloadUrl, {
		redirect: "follow",
		headers: { "User-Agent": "Node-ensure-yt-dlp" },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	const buf = Buffer.from(await res.arrayBuffer());
	fs.writeFileSync(destPath, buf, { mode: 0o755 });
}

async function main() {
	if (inPath()) {
		console.log("yt-dlp found in PATH, skipping download.");
		return;
	}
	if (localExistsAndExecutable()) {
		console.log("yt-dlp found at", destPath, ", skipping download.");
		return;
	}
	console.log("yt-dlp not in PATH or project root. Downloading to", destPath, "...");
	try {
		await download(url);
		if (!isWin) fs.chmodSync(destPath, 0o755);
		console.log("Downloaded yt-dlp to", destPath);
	} catch (err) {
		console.error("Failed to download yt-dlp:", err.message);
		process.exit(1);
	}
}

main();
