/**
 * MessageCreate Event Handler - Responds to specific messages.
 *
 * Demonstrates:
 * - Event handler structure for Discord.js events
 * - Filtering messages (ignore bots, check content)
 * - Accessing services and config from ctx
 * - Non-blocking event handling
 *
 * EVENT DISCOVERY:
 * Events are auto-discovered from bot/[feature]/events/*.js
 * Multiple features can handle the same event - they run in FEATURE_ORDER.
 *
 * @module zen-bot/example/events/messageCreate
 */

const { createLogger } = require("../../core/logger");
const config = require("../config");

const log = createLogger("example-events");

module.exports = {
	// ─────────────────────────────────────────────────────────────────────────
	// EVENT METADATA
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Event name - must match a Discord.js or discord-player event.
	 * @type {string}
	 */
	event: "messageCreate",

	/**
	 * Event target - where to attach the handler.
	 * - "client" for Discord.js events (messageCreate, ready, etc.)
	 * - "player" for discord-player events (playerStart, emptyQueue, etc.)
	 * @type {string}
	 */
	target: "client",

	// ─────────────────────────────────────────────────────────────────────────
	// EVENT HANDLER
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Handle the event.
	 *
	 * The arguments match the Discord.js/discord-player event signature,
	 * with ctx appended as the last argument.
	 *
	 * @param {import('discord.js').Message} message - The message object
	 * @param {object} ctx - Shared context object
	 *
	 * @example Event signature for messageCreate:
	 * client.on('messageCreate', (message) => { ... })
	 * becomes:
	 * async handle(message, ctx) { ... }
	 */
	async handle(message, ctx) {
		// ───────────────────────────────────────────────────────────────────────
		// EARLY RETURNS / FILTERS
		// ───────────────────────────────────────────────────────────────────────
		// Always check conditions early and return to avoid unnecessary processing

		// Ignore bot messages (including our own)
		if (message.author.bot) return;

		// Check if feature is enabled
		if (!config.featureEnabled) return;

		// Only process in guilds (not DMs)
		if (!message.guild) return;

		// ───────────────────────────────────────────────────────────────────────
		// HANDLE SPECIFIC MESSAGES
		// ───────────────────────────────────────────────────────────────────────
		// This example responds when someone says "good bot"

		const content = message.content.toLowerCase();

		// Respond to "good bot"
		if (content.includes("good bot")) {
			log.debug(`Received "good bot" from ${message.author.username}`);

			try {
				await message.react("❤️");
				log.info(`Reacted to "good bot" from ${message.author.username}`);
			} catch (err) {
				log.warn(`Failed to react: ${err.message}`);
			}

			return;
		}

		// Respond to "bad bot"
		if (content.includes("bad bot")) {
			log.debug(`Received "bad bot" from ${message.author.username}`);

			try {
				await message.react("😢");
				log.info(`Reacted to "bad bot" from ${message.author.username}`);
			} catch (err) {
				log.warn(`Failed to react: ${err.message}`);
			}

			return;
		}

		// ───────────────────────────────────────────────────────────────────────
		// VERBOSE LOGGING (optional)
		// ───────────────────────────────────────────────────────────────────────
		// Log message activity when verbose mode is enabled

		if (config.verbose) {
			log.debug(`Message in #${message.channel.name}: ${message.content.slice(0, 50)}`);
		}
	},
};
