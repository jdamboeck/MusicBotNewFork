/**
 * Empty queue event - stops tracking session.
 */

const { createLogger } = require("../../core/logger");
const services = require("../services");

const log = createLogger("music-comments");

module.exports = {
	event: "emptyQueue",
	target: "player",

	async handle(queue, ctx) {
		const guildId = queue?.channel?.guild?.id;
		if (guildId) {
			log.debug("Empty queue: stopping comment tracking session (guild:", guildId, ")");
			services.stopTrackingSession(guildId);
		}
	},
};
