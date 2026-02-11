/**
 * Music comments feature - Track comment system.
 */

const { createLogger } = require("../core/logger");
const services = require("./services");

const log = createLogger("music-comments");

/**
 * Initialize the music-comments feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing music-comments...");

	// Export services for other features
	ctx.services.comments = services;

	log.info("Music-comments initialized");
}

module.exports = { init };
