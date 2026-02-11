/**
 * Database module - SQLite connection and all queries.
 * Handles both play history and track comments tables.
 */

const Database = require("better-sqlite3");
const { createLogger } = require("../core/logger");
const config = require("./config");

const log = createLogger("database");

let db = null;

/**
 * Initialize the database and create tables if they don't exist.
 * @returns {Database.Database}
 */
function initDatabase() {
	if (db) return db;

	db = new Database(config.dbPath);

	// Create the play_history table
	db.exec(`
		CREATE TABLE IF NOT EXISTS play_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			video_url TEXT NOT NULL,
			video_title TEXT NOT NULL,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			guild_id TEXT NOT NULL,
			played_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_video_url ON play_history(video_url);
		CREATE INDEX IF NOT EXISTS idx_user_id ON play_history(user_id);
		CREATE INDEX IF NOT EXISTS idx_guild_id ON play_history(guild_id);
	`);

	// Create the track_comments table
	db.exec(`
		CREATE TABLE IF NOT EXISTS track_comments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			video_url TEXT NOT NULL,
			guild_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			comment_text TEXT NOT NULL,
			timestamp_ms INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_track_comments_video ON track_comments(video_url, guild_id);
	`);

	log.info("Initialized SQLite database at", config.dbPath);
	return db;
}

// ---- Play History Queries ----

/**
 * Record a video play in the database.
 */
function recordPlay({ videoUrl, videoTitle, userId, userName, guildId }) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		INSERT INTO play_history (video_url, video_title, user_id, user_name, guild_id)
		VALUES (?, ?, ?, ?, ?)
	`);

	stmt.run(videoUrl, videoTitle, userId, userName, guildId);
	log.debug(`Recorded play: "${videoTitle}" by ${userName}`);
}

/**
 * Get the top played videos overall in a guild.
 */
function getTopVideosOverall(guildId, limit = 10) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT 
			video_url,
			video_title,
			COUNT(*) as play_count,
			MAX(played_at) as last_played
		FROM play_history
		WHERE guild_id = ?
		GROUP BY video_url
		ORDER BY play_count DESC, last_played DESC
		LIMIT ?
	`);

	return stmt.all(guildId, limit);
}

/**
 * Get the top played videos by a specific user.
 */
function getTopVideosByUser(guildId, userId, limit = 10) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT 
			video_url,
			video_title,
			COUNT(*) as play_count,
			MAX(played_at) as last_played
		FROM play_history
		WHERE guild_id = ? AND user_id = ?
		GROUP BY video_url
		ORDER BY play_count DESC, last_played DESC
		LIMIT ?
	`);

	return stmt.all(guildId, userId, limit);
}

/**
 * Get total play count for a guild.
 */
function getTotalPlays(guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT COUNT(*) as total FROM play_history WHERE guild_id = ?
	`);

	return stmt.get(guildId)?.total ?? 0;
}

/**
 * Get total play count for a user in a guild.
 */
function getUserTotalPlays(guildId, userId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT COUNT(*) as total FROM play_history WHERE guild_id = ? AND user_id = ?
	`);

	return stmt.get(guildId, userId)?.total ?? 0;
}

/**
 * Get the top listeners in a guild.
 */
function getTopListeners(guildId, limit = 10) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT 
			user_id,
			user_name,
			COUNT(*) as play_count
		FROM play_history
		WHERE guild_id = ?
		GROUP BY user_id
		ORDER BY play_count DESC
		LIMIT ?
	`);

	return stmt.all(guildId, limit);
}

/**
 * Clear all music stats for a guild.
 */
function clearMusicStats(guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		DELETE FROM play_history WHERE guild_id = ?
	`);

	const result = stmt.run(guildId);
	log.info(`Cleared ${result.changes} music stats records for guild ${guildId}`);
	return result.changes;
}

// ---- Track Comment Queries ----

/**
 * Save a track comment with its timestamp.
 */
function saveTrackComment({ videoUrl, guildId, userId, userName, commentText, timestampMs }) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		INSERT INTO track_comments (video_url, guild_id, user_id, user_name, comment_text, timestamp_ms)
		VALUES (?, ?, ?, ?, ?, ?)
	`);

	stmt.run(videoUrl, guildId, userId, userName, commentText, timestampMs);
	log.debug(`Saved track comment at ${timestampMs}ms by ${userName}`);
}

/**
 * Get all comments for a track in a guild, sorted by timestamp.
 */
function getTrackComments(videoUrl, guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT id, user_id, user_name, comment_text, timestamp_ms, created_at
		FROM track_comments
		WHERE video_url = ? AND guild_id = ?
		ORDER BY timestamp_ms ASC
	`);

	return stmt.all(videoUrl, guildId);
}

/**
 * Clear all track comments for a guild.
 */
function clearTrackComments(guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		DELETE FROM track_comments WHERE guild_id = ?
	`);

	const result = stmt.run(guildId);
	log.info(`Cleared ${result.changes} track comments for guild ${guildId}`);
	return result.changes;
}

/**
 * Clear all track comments for a specific video in a guild.
 */
function clearVideoComments(videoUrl, guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		DELETE FROM track_comments WHERE video_url = ? AND guild_id = ?
	`);

	const result = stmt.run(videoUrl, guildId);
	log.info(`Cleared ${result.changes} comments for video in guild ${guildId}`);
	return result.changes;
}

/**
 * Close the database connection.
 */
function closeDatabase() {
	if (db) {
		db.close();
		db = null;
		log.info("Closed database connection");
	}
}

module.exports = {
	initDatabase,
	recordPlay,
	getTopVideosOverall,
	getTopVideosByUser,
	getTopListeners,
	getTotalPlays,
	getUserTotalPlays,
	clearMusicStats,
	saveTrackComment,
	getTrackComments,
	clearTrackComments,
	clearVideoComments,
	closeDatabase,
};
