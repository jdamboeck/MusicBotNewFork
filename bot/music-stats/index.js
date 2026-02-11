/**
 * Music stats feature - Database initialization and play tracking.
 */

const { createLogger } = require("../core/logger");
const database = require("./database");

const log = createLogger("music-stats");

/**
 * Initialize the music-stats feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing music-stats...");

	// Initialize database
	database.initDatabase();

	// Export database for other features
	ctx.db = database;

	log.info("Music-stats initialized");
}

module.exports = { init };
