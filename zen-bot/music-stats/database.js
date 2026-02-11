/**
 * Music Stats Database Module - Play history and track comments.
 *
 * This module registers the 'music' namespace on ctx.db, providing
 * all database operations for music playback tracking and comments.
 *
 * Access via: ctx.db.music.[method]
 *
 * @module zen-bot/music-stats/database
 */

const { createLogger } = require("../core/logger");

const log = createLogger("music-db");

/**
 * Initialize the music database namespace.
 *
 * This function is passed to ctx.db.register() and receives the raw
 * database connection. It creates the required tables and returns
 * an object with all query functions.
 *
 * @param {import('better-sqlite3').Database} db - Database connection
 * @returns {object} Object with query functions
 */
function initMusicDatabase(db) {
	// ─────────────────────────────────────────────────────────────────────────
	// TABLE CREATION
	// ─────────────────────────────────────────────────────────────────────────

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

		CREATE INDEX IF NOT EXISTS idx_play_history_video_url ON play_history(video_url);
		CREATE INDEX IF NOT EXISTS idx_play_history_user_id ON play_history(user_id);
		CREATE INDEX IF NOT EXISTS idx_play_history_guild_id ON play_history(guild_id);
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

	// Create the track_reactions table (reactions on enqueued message, synced playback)
	db.exec(`
		CREATE TABLE IF NOT EXISTS track_reactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			video_url TEXT NOT NULL,
			guild_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			reaction_emoji TEXT NOT NULL,
			timestamp_ms INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_track_reactions_video ON track_reactions(video_url, guild_id);
	`);

	log.info("Music database tables initialized");

	// ─────────────────────────────────────────────────────────────────────────
	// QUERY FUNCTIONS
	// ─────────────────────────────────────────────────────────────────────────
	// Return an object with all query functions for the 'music' namespace

	return {
		// ───────────────────────────────────────────────────────────────────────
		// PLAY HISTORY
		// ───────────────────────────────────────────────────────────────────────

		/**
		 * Record a video play in the database.
		 * @param {object} data - Play data
		 * @param {string} data.videoUrl - Video URL
		 * @param {string} data.videoTitle - Video title
		 * @param {string} data.userId - User ID
		 * @param {string} data.userName - User name
		 * @param {string} data.guildId - Guild ID
		 */
		recordPlay({ videoUrl, videoTitle, userId, userName, guildId }) {
			const stmt = db.prepare(`
				INSERT INTO play_history (video_url, video_title, user_id, user_name, guild_id)
				VALUES (?, ?, ?, ?, ?)
			`);
			stmt.run(videoUrl, videoTitle, userId, userName, guildId);
			log.debug(`Recorded play: "${videoTitle}" by ${userName}`);
		},

		/**
		 * Get the top played videos overall in a guild.
		 * @param {string} guildId - Guild ID
		 * @param {number} [limit=10] - Maximum results
		 * @returns {Array<{video_url: string, video_title: string, play_count: number, last_played: string}>}
		 */
		getTopVideosOverall(guildId, limit = 10) {
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
		},

		/**
		 * Get the top played videos by a specific user.
		 * @param {string} guildId - Guild ID
		 * @param {string} userId - User ID
		 * @param {number} [limit=10] - Maximum results
		 * @returns {Array<{video_url: string, video_title: string, play_count: number, last_played: string}>}
		 */
		getTopVideosByUser(guildId, userId, limit = 10) {
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
		},

		/**
		 * Get total play count for a guild.
		 * @param {string} guildId - Guild ID
		 * @returns {number}
		 */
		getTotalPlays(guildId) {
			const stmt = db.prepare(`
				SELECT COUNT(*) as total FROM play_history WHERE guild_id = ?
			`);
			return stmt.get(guildId)?.total ?? 0;
		},

		/**
		 * Get total play count for a user in a guild.
		 * @param {string} guildId - Guild ID
		 * @param {string} userId - User ID
		 * @returns {number}
		 */
		getUserTotalPlays(guildId, userId) {
			const stmt = db.prepare(`
				SELECT COUNT(*) as total FROM play_history WHERE guild_id = ? AND user_id = ?
			`);
			return stmt.get(guildId, userId)?.total ?? 0;
		},

		/**
		 * Get the top listeners in a guild.
		 * @param {string} guildId - Guild ID
		 * @param {number} [limit=10] - Maximum results
		 * @returns {Array<{user_id: string, user_name: string, play_count: number}>}
		 */
		getTopListeners(guildId, limit = 10) {
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
		},

		/**
		 * Get the last played video in a guild.
		 * @param {string} guildId - Guild ID
		 * @returns {{video_url: string, video_title: string, played_at: string}|null}
		 */
		getLastPlayedVideo(guildId) {
			const stmt = db.prepare(`
				SELECT video_url, video_title, played_at
				FROM play_history
				WHERE guild_id = ?
				ORDER BY played_at DESC
				LIMIT 1
			`);
			return stmt.get(guildId) || null;
		},

		/**
		 * Clear all music stats for a guild.
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of deleted records
		 */
		clearMusicStats(guildId) {
			const stmt = db.prepare(`
				DELETE FROM play_history WHERE guild_id = ?
			`);
			const result = stmt.run(guildId);
			log.info(`Cleared ${result.changes} music stats records for guild ${guildId}`);
			return result.changes;
		},

		// ───────────────────────────────────────────────────────────────────────
		// TRACK COMMENTS
		// ───────────────────────────────────────────────────────────────────────

		/**
		 * Save a track comment with its timestamp.
		 * @param {object} data - Comment data
		 * @param {string} data.videoUrl - Video URL
		 * @param {string} data.guildId - Guild ID
		 * @param {string} data.userId - User ID
		 * @param {string} data.userName - User name
		 * @param {string} data.commentText - Comment text
		 * @param {number} data.timestampMs - Timestamp in milliseconds
		 */
		saveTrackComment({ videoUrl, guildId, userId, userName, commentText, timestampMs }) {
			const stmt = db.prepare(`
				INSERT INTO track_comments (video_url, guild_id, user_id, user_name, comment_text, timestamp_ms)
				VALUES (?, ?, ?, ?, ?, ?)
			`);
			stmt.run(videoUrl, guildId, userId, userName, commentText, timestampMs);
			log.debug(`Saved track comment at ${timestampMs}ms by ${userName}`);
		},

		/**
		 * Get all comments for a track in a guild, sorted by timestamp.
		 * @param {string} videoUrl - Video URL
		 * @param {string} guildId - Guild ID
		 * @returns {Array<{id: number, user_id: string, user_name: string, comment_text: string, timestamp_ms: number, created_at: string}>}
		 */
		getTrackComments(videoUrl, guildId) {
			const stmt = db.prepare(`
				SELECT id, user_id, user_name, comment_text, timestamp_ms, created_at
				FROM track_comments
				WHERE video_url = ? AND guild_id = ?
				ORDER BY timestamp_ms ASC
			`);
			return stmt.all(videoUrl, guildId);
		},

		/**
		 * Clear all track comments for a guild.
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of deleted records
		 */
		clearTrackComments(guildId) {
			const stmt = db.prepare(`
				DELETE FROM track_comments WHERE guild_id = ?
			`);
			const result = stmt.run(guildId);
			log.info(`Cleared ${result.changes} track comments for guild ${guildId}`);
			return result.changes;
		},

		/**
		 * Clear all track comments for a specific video in a guild.
		 * @param {string} videoUrl - Video URL
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of deleted records
		 */
		clearVideoComments(videoUrl, guildId) {
			const stmt = db.prepare(`
				DELETE FROM track_comments WHERE video_url = ? AND guild_id = ?
			`);
			const result = stmt.run(videoUrl, guildId);
			log.info(`Cleared ${result.changes} comments for video in guild ${guildId}`);
			return result.changes;
		},

		// ───────────────────────────────────────────────────────────────────────
		// TRACK REACTIONS
		// ───────────────────────────────────────────────────────────────────────

		/**
		 * Save a track reaction (on enqueued message) with its timestamp.
		 */
		saveTrackReaction({ videoUrl, guildId, userId, userName, reactionEmoji, timestampMs }) {
			const stmt = db.prepare(`
				INSERT INTO track_reactions (video_url, guild_id, user_id, user_name, reaction_emoji, timestamp_ms)
				VALUES (?, ?, ?, ?, ?, ?)
			`);
			stmt.run(videoUrl, guildId, userId, userName, reactionEmoji, timestampMs);
			log.debug(`Saved track reaction at ${timestampMs}ms by ${userName}: ${reactionEmoji}`);
		},

		/**
		 * Get all reactions for a track in a guild, sorted by timestamp.
		 */
		getTrackReactions(videoUrl, guildId) {
			const stmt = db.prepare(`
				SELECT id, user_id, user_name, reaction_emoji, timestamp_ms, created_at
				FROM track_reactions
				WHERE video_url = ? AND guild_id = ?
				ORDER BY timestamp_ms ASC
			`);
			return stmt.all(videoUrl, guildId);
		},

		/**
		 * Clear all track reactions for a guild.
		 */
		clearTrackReactions(guildId) {
			const stmt = db.prepare(`
				DELETE FROM track_reactions WHERE guild_id = ?
			`);
			const result = stmt.run(guildId);
			log.info(`Cleared ${result.changes} track reactions for guild ${guildId}`);
			return result.changes;
		},

		/**
		 * Clear all track reactions for a specific video in a guild.
		 */
		clearVideoReactions(videoUrl, guildId) {
			const stmt = db.prepare(`
				DELETE FROM track_reactions WHERE video_url = ? AND guild_id = ?
			`);
			const result = stmt.run(videoUrl, guildId);
			log.info(`Cleared ${result.changes} reactions for video in guild ${guildId}`);
			return result.changes;
		},
	};
}

module.exports = { initMusicDatabase };
