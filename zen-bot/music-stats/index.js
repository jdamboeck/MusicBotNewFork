/**
 * Music stats feature - Database namespace for play tracking and comments.
 *
 * This feature registers the 'music' namespace on ctx.db, providing
 * database operations for music playback history and track comments.
 *
 * Access: ctx.db.music.[method]
 */

const { createLogger } = require("../core/logger");
const { initMusicDatabase } = require("./database");

const log = createLogger("music-stats");

/**
 * Initialize the music-stats feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing music-stats...");

	// Register the 'music' database namespace
	// This makes all music database functions available at ctx.db.music
	ctx.db.register("music", initMusicDatabase);

	log.info("Music-stats initialized (ctx.db.music available)");
}

module.exports = { init };
