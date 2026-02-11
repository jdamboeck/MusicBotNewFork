/**
 * Player error event handler.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("player");

module.exports = {
	event: "playerError",
	target: "player",

	async handle(queue, error, ctx) {
		const guildId = queue?.guild?.id ?? "unknown";
		log.error("Audio player error (guild:", guildId, "):", error.message);
		log.debug("Player error details:", error);
	},
};
