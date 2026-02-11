/**
 * Core configuration - defaults with env overrides.
 */

// Load bot token from environment or config file
let botToken = process.env.BOT_TOKEN;
if (!botToken) {
	try {
		botToken = require("../../env.json").botToken;
	} catch (e) {
		if (e.code === "MODULE_NOT_FOUND" || e.message?.includes("JSON")) {
			console.error("Missing or invalid env.json. Copy env.example.json to env.json and set your botToken (or set BOT_TOKEN env var).");
			process.exit(1);
		}
		throw e;
	}
}
if (!botToken) {
	console.error("env.json must contain botToken (or set BOT_TOKEN env var).");
	process.exit(1);
}

module.exports = {
	botToken,
	prefix: process.env.PREFIX || "#",
};
