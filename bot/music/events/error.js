/**
 * Queue error event handler.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("player");

module.exports = {
	event: "error",
	target: "player",

	async handle(queue, error, ctx) {
		log.error("Error emitted from the queue:", error.message);
	},
};
