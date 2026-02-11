/**
 * Discord Music Bot - Entry Point
 */

const { start } = require("./bot");

start().catch((err) => {
	console.error("Failed to start bot:", err);
	process.exit(1);
});
