/**
 * Ready Event Handler - Runs when the bot connects to Discord.
 *
 * Demonstrates:
 * - One-time initialization events
 * - Accessing ctx.client for bot information
 * - Logging startup information
 *
 * NOTE: This event fires once when the bot first connects.
 * Multiple features can have ready handlers - they all run.
 *
 * @module zen-bot/example/events/ready
 */

const { createLogger } = require("../../core/logger");
const config = require("../config");

const log = createLogger("example-ready");

module.exports = {
	event: "ready",
	target: "client",

	/**
	 * Handle the ready event.
	 *
	 * @param {import('discord.js').Client} client - The ready client (first arg from ready event)
	 * @param {object} ctx - Shared context object
	 */
	async handle(client, ctx) {
		// Note: For the 'ready' event, Discord.js passes the client as the first argument
		// ctx is always appended as the last argument by the feature loader

		log.info("Example feature is ready!");
		log.info(`Greeting configured: "${config.greeting}"`);
		log.info(`Max greetings: ${config.maxGreetings}`);
		log.info(`Cooldown: ${config.cooldownFormatted}`);

		// ───────────────────────────────────────────────────────────────────────
		// ACCESS BOT INFORMATION
		// ───────────────────────────────────────────────────────────────────────
		// The client is fully connected at this point

		log.info(`Bot is in ${ctx.client.guilds.cache.size} guilds`);

		// List guild names (useful for debugging)
		if (config.verbose) {
			for (const [, guild] of ctx.client.guilds.cache) {
				log.debug(`  - ${guild.name} (${guild.memberCount} members)`);
			}
		}

		// ───────────────────────────────────────────────────────────────────────
		// ONE-TIME SETUP
		// ───────────────────────────────────────────────────────────────────────
		// Perform any initialization that requires the bot to be connected

		// Example: Could set up scheduled tasks, sync data, etc.
	},
};
