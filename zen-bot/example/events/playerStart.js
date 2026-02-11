/**
 * PlayerStart Event Handler - Runs when a track starts playing.
 *
 * Demonstrates:
 * - discord-player event handling (target: "player")
 * - Accessing queue and track information
 * - Inter-feature communication via ctx.services
 *
 * PLAYER EVENTS:
 * discord-player emits events through player.events, not directly on the player.
 * The feature loader handles this automatically when target is "player".
 *
 * Common player events:
 * - playerStart: Track started playing
 * - playerFinish: Track finished
 * - playerError: Playback error
 * - error: Queue error
 * - emptyQueue: Queue finished
 * - emptyChannel: Voice channel empty
 *
 * @module zen-bot/example/events/playerStart
 */

const { createLogger } = require("../../core/logger");
const config = require("../config");

const log = createLogger("example-player");

module.exports = {
	event: "playerStart",
	target: "player", // <-- Note: "player" not "client"

	/**
	 * Handle the playerStart event.
	 *
	 * @param {import('discord-player').GuildQueue} queue - The guild queue
	 * @param {import('discord-player').Track} track - The track that started
	 * @param {object} ctx - Shared context object
	 *
	 * @example Event signature for playerStart:
	 * player.events.on('playerStart', (queue, track) => { ... })
	 * becomes:
	 * async handle(queue, track, ctx) { ... }
	 */
	async handle(queue, track, ctx) {
		if (!config.featureEnabled) return;

		log.debug(`Track started: "${track.title}"`);

		// ───────────────────────────────────────────────────────────────────────
		// ACCESS QUEUE METADATA
		// ───────────────────────────────────────────────────────────────────────
		// Queue metadata contains the original message and other data

		const metadata = queue.metadata;
		if (metadata?.channel) {
			log.debug(`Playing in channel: ${metadata.channel.name}`);
		}

		// ───────────────────────────────────────────────────────────────────────
		// INTER-FEATURE COMMUNICATION
		// ───────────────────────────────────────────────────────────────────────
		// Access other features' services through ctx.services

		// Example: Log to music stats if available
		if (ctx.db) {
			log.debug(`Track URL: ${track.url}`);
			log.debug(`Requested by: ${track.requestedBy?.username || "Unknown"}`);
		}

		// ───────────────────────────────────────────────────────────────────────
		// EXAMPLE: LOG PLAYBACK TO CONSOLE
		// ───────────────────────────────────────────────────────────────────────
		// This is just for demonstration - real features would do more

		if (config.verbose) {
			log.info(`Now playing: "${track.title}" by ${track.author}`);
			log.info(`Duration: ${track.duration}`);
			log.info(`Source: ${track.source}`);
		}
	},
};
