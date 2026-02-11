/**
 * Example Feature Database Module
 *
 * Demonstrates how to register a database namespace for your feature.
 * This creates the 'example' namespace on ctx.db with all query functions.
 *
 * Access via: ctx.db.example.[method]
 *
 * PATTERN:
 * 1. Export an init function that receives the raw database connection
 * 2. Create your tables in the init function
 * 3. Return an object with all your query functions
 * 4. Register in your feature's index.js: ctx.db.register("example", initExampleDatabase)
 *
 * @module zen-bot/example/database
 */

const { createLogger } = require("../core/logger");

const log = createLogger("example-db");

/**
 * Initialize the example database namespace.
 *
 * This function is passed to ctx.db.register() and receives the raw
 * better-sqlite3 database connection. It should:
 * 1. Create any required tables
 * 2. Return an object with all query functions
 *
 * @param {import('better-sqlite3').Database} db - Database connection
 * @returns {object} Object with query functions for ctx.db.example
 */
function initExampleDatabase(db) {
	// ─────────────────────────────────────────────────────────────────────────
	// TABLE CREATION
	// ─────────────────────────────────────────────────────────────────────────
	// Use CREATE TABLE IF NOT EXISTS to be idempotent

	db.exec(`
		CREATE TABLE IF NOT EXISTS example_greetings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			guild_id TEXT NOT NULL,
			greeting_text TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_example_greetings_user 
			ON example_greetings(user_id, guild_id);
		CREATE INDEX IF NOT EXISTS idx_example_greetings_guild 
			ON example_greetings(guild_id);
	`);

	log.info("Example database tables initialized");

	// ─────────────────────────────────────────────────────────────────────────
	// QUERY FUNCTIONS
	// ─────────────────────────────────────────────────────────────────────────
	// Return an object with all query functions
	// These become available at ctx.db.example.[methodName]

	return {
		/**
		 * Save a greeting to the database.
		 *
		 * @param {object} data - Greeting data
		 * @param {string} data.userId - Discord user ID
		 * @param {string} data.userName - User's display name
		 * @param {string} data.guildId - Guild ID
		 * @param {string} data.greetingText - The greeting message
		 */
		saveGreeting({ userId, userName, guildId, greetingText }) {
			const stmt = db.prepare(`
				INSERT INTO example_greetings (user_id, user_name, guild_id, greeting_text)
				VALUES (?, ?, ?, ?)
			`);
			stmt.run(userId, userName, guildId, greetingText);
			log.debug(`Saved greeting for ${userName}`);
		},

		/**
		 * Get greeting count for a user in a guild.
		 *
		 * @param {string} userId - Discord user ID
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of greetings
		 */
		getGreetingCount(userId, guildId) {
			const stmt = db.prepare(`
				SELECT COUNT(*) as count 
				FROM example_greetings 
				WHERE user_id = ? AND guild_id = ?
			`);
			return stmt.get(userId, guildId)?.count ?? 0;
		},

		/**
		 * Get total greeting count for a guild.
		 *
		 * @param {string} guildId - Guild ID
		 * @returns {number} Total greetings
		 */
		getTotalGreetings(guildId) {
			const stmt = db.prepare(`
				SELECT COUNT(*) as count 
				FROM example_greetings 
				WHERE guild_id = ?
			`);
			return stmt.get(guildId)?.count ?? 0;
		},

		/**
		 * Get recent greetings for a guild.
		 *
		 * @param {string} guildId - Guild ID
		 * @param {number} [limit=10] - Maximum results
		 * @returns {Array<{id: number, user_id: string, user_name: string, greeting_text: string, created_at: string}>}
		 */
		getRecentGreetings(guildId, limit = 10) {
			const stmt = db.prepare(`
				SELECT id, user_id, user_name, greeting_text, created_at
				FROM example_greetings
				WHERE guild_id = ?
				ORDER BY created_at DESC
				LIMIT ?
			`);
			return stmt.all(guildId, limit);
		},

		/**
		 * Get top greeters in a guild.
		 *
		 * @param {string} guildId - Guild ID
		 * @param {number} [limit=10] - Maximum results
		 * @returns {Array<{user_id: string, user_name: string, greeting_count: number}>}
		 */
		getTopGreeters(guildId, limit = 10) {
			const stmt = db.prepare(`
				SELECT 
					user_id,
					user_name,
					COUNT(*) as greeting_count
				FROM example_greetings
				WHERE guild_id = ?
				GROUP BY user_id
				ORDER BY greeting_count DESC
				LIMIT ?
			`);
			return stmt.all(guildId, limit);
		},

		/**
		 * Clear all greetings for a user in a guild.
		 *
		 * @param {string} userId - Discord user ID
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of deleted records
		 */
		clearUserGreetings(userId, guildId) {
			const stmt = db.prepare(`
				DELETE FROM example_greetings 
				WHERE user_id = ? AND guild_id = ?
			`);
			const result = stmt.run(userId, guildId);
			log.debug(`Cleared ${result.changes} greetings for user ${userId}`);
			return result.changes;
		},

		/**
		 * Clear all greetings for a guild.
		 *
		 * @param {string} guildId - Guild ID
		 * @returns {number} Number of deleted records
		 */
		clearAllGreetings(guildId) {
			const stmt = db.prepare(`
				DELETE FROM example_greetings WHERE guild_id = ?
			`);
			const result = stmt.run(guildId);
			log.info(`Cleared ${result.changes} greetings for guild ${guildId}`);
			return result.changes;
		},
	};
}

module.exports = { initExampleDatabase };
