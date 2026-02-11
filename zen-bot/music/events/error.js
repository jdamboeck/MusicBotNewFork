/**
 * Queue error event handler.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("player");

module.exports = {
	event: "error",
	target: "player",

	async handle(queue, error, ctx) {
		const guildId = queue?.guild?.id ?? "unknown";
		log.error("Queue error (guild:", guildId, "):", error.message);
		log.debug("Queue error details:", error);
	},
};
