const Database = require("better-sqlite3");
const path = require("path");

// Database file location (in project root)
const DB_PATH = path.join(__dirname, "..", "musicstats.db");

let db = null;

/**
 * Initialize the database and create tables if they don't exist.
 * @returns {Database.Database}
 */
function initDatabase() {
	if (db) return db;

	db = new Database(DB_PATH);

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

	console.log("[Database] Initialized SQLite database at", DB_PATH);
	return db;
}

/**
 * Record a video play in the database.
 * @param {Object} params
 * @param {string} params.videoUrl - The URL of the video
 * @param {string} params.videoTitle - The title of the video
 * @param {string} params.userId - Discord user ID who played it
 * @param {string} params.userName - Discord username
 * @param {string} params.guildId - Discord guild/server ID
 */
function recordPlay({ videoUrl, videoTitle, userId, userName, guildId }) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		INSERT INTO play_history (video_url, video_title, user_id, user_name, guild_id)
		VALUES (?, ?, ?, ?, ?)
	`);

	stmt.run(videoUrl, videoTitle, userId, userName, guildId);
	console.log(`[Database] Recorded play: "${videoTitle}" by ${userName}`);
}

/**
 * Get the top played videos overall (across all users in a guild).
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Number of results to return
 * @returns {Array<{video_url: string, video_title: string, play_count: number, last_played: string}>}
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
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @param {number} limit - Number of results to return
 * @returns {Array<{video_url: string, video_title: string, play_count: number, last_played: string}>}
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
 * @param {string} guildId - Discord guild ID
 * @returns {number}
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
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {number}
 */
function getUserTotalPlays(guildId, userId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		SELECT COUNT(*) as total FROM play_history WHERE guild_id = ? AND user_id = ?
	`);

	return stmt.get(guildId, userId)?.total ?? 0;
}

/**
 * Get the top listeners (users with most plays) in a guild.
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Number of results to return
 * @returns {Array<{user_id: string, user_name: string, play_count: number}>}
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
 * @param {string} guildId - Discord guild ID
 * @returns {number} Number of records deleted
 */
function clearMusicStats(guildId) {
	if (!db) initDatabase();

	const stmt = db.prepare(`
		DELETE FROM play_history WHERE guild_id = ?
	`);

	const result = stmt.run(guildId);
	console.log(`[Database] Cleared ${result.changes} music stats records for guild ${guildId}`);
	return result.changes;
}

/**
 * Close the database connection.
 */
function closeDatabase() {
	if (db) {
		db.close();
		db = null;
		console.log("[Database] Closed database connection");
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
	closeDatabase,
};
