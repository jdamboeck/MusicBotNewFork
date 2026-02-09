#!/usr/bin/env node
/**
 * Ensures the bgutil-ytdlp-pot-provider plugin is available:
 * - Clones the repo if missing
 * - Copies the plugin into project yt-dlp-plugins/ so yt-dlp (next to ./yt-dlp) loads it
 * - Installs and builds the provider server
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const repoUrl = "https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git";
const branch = "1.2.2";
const repoDir = path.join(projectRoot, "bgutil-ytdlp-pot-provider");
const pluginSource = path.join(repoDir, "plugin");
const pluginDest = path.join(projectRoot, "yt-dlp-plugins", "bgutil-ytdlp-pot-provider");
const serverDir = path.join(repoDir, "server");

function cloneRepo() {
	if (fs.existsSync(path.join(repoDir, ".git"))) {
		console.log("bgutil-ytdlp-pot-provider already cloned, skipping clone.");
		return;
	}
	console.log("Cloning bgutil-ytdlp-pot-provider...");
	const r = spawnSync("git", ["clone", "--single-branch", "--branch", branch, repoUrl, repoDir], {
		stdio: "inherit",
		cwd: projectRoot,
	});
	if (r.status !== 0) {
		console.error("Failed to clone bgutil-ytdlp-pot-provider.");
		process.exit(1);
	}
}

function copyPlugin() {
	if (!fs.existsSync(pluginSource)) {
		console.error("Plugin source not found:", pluginSource);
		process.exit(1);
	}
	fs.mkdirSync(pluginDest, { recursive: true });
	// Copy contents of plugin/ into yt-dlp-plugins/bgutil-ytdlp-pot-provider/
	const entries = fs.readdirSync(pluginSource, { withFileTypes: true });
	for (const ent of entries) {
		const src = path.join(pluginSource, ent.name);
		const dest = path.join(pluginDest, ent.name);
		if (ent.isDirectory()) {
			fs.cpSync(src, dest, { recursive: true });
		} else {
			fs.copyFileSync(src, dest);
		}
	}
	console.log("Plugin installed to", pluginDest);
}

function buildServer() {
	if (!fs.existsSync(serverDir)) {
		console.error("Server directory not found:", serverDir);
		process.exit(1);
	}
	console.log("Installing server dependencies...");
	let r = spawnSync("npm", ["install"], { stdio: "inherit", cwd: serverDir });
	if (r.status !== 0) {
		console.error("npm install failed in bgutil-ytdlp-pot-provider/server");
		process.exit(1);
	}
	console.log("Building server (tsc)...");
	r = spawnSync("npx", ["tsc"], { stdio: "inherit", cwd: serverDir });
	if (r.status !== 0) {
		console.error("npx tsc failed in bgutil-ytdlp-pot-provider/server");
		process.exit(1);
	}
	console.log("bgutil-ytdlp-pot-provider ready.");
}

function main() {
	cloneRepo();
	copyPlugin();
	buildServer();
}

main();
