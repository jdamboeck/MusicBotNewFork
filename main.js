/**
 * zen-bot for Discord - Entry Point
 */

const { start } = require("./zen-bot");

start().catch((err) => {
	console.error("Failed to start zen-bot:", err);
	process.exit(1);
});
