/**
 * Moderation feature - Channel moderation commands.
 */

const { createLogger } = require("../core/logger");

const log = createLogger("moderation");

/**
 * Initialize the moderation feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing moderation...");
	log.info("Moderation initialized");
}

module.exports = { init };
