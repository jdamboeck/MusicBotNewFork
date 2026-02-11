/**
 * Player error event handler.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("player");

module.exports = {
	event: "playerError",
	target: "player",

	async handle(queue, error, ctx) {
		log.error("Audio player error:", error.message);
	},
};
