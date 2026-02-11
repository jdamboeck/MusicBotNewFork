/**
 * Core Database Module - Shared SQLite connection with namespaced access.
 *
 * This module provides a single database connection that multiple features
 * can use by registering their own namespaces. Each feature adds its tables
 * and query functions to ctx.db.[namespace].
 *
 * PATTERN:
 * - Core initializes the database connection
 * - Features call ctx.db.register(namespace, initFn) to add their tables
 * - Query functions are accessed via ctx.db.[namespace].[method]
 *
 * @module zen-bot/core/database
 */

const Database = require("better-sqlite3");
const { createLogger } = require("./logger");

const log = createLogger("database");

/**
 * Database path - configurable via environment variable.
 * @type {string}
 */
const dbPath = process.env.DB_PATH || "zen-bot.db";

/**
 * The shared database connection.
 * @type {Database.Database|null}
 */
let db = null;

/**
 * Get or create the database connection.
 * @returns {Database.Database}
 */
function getConnection() {
	if (!db) {
		db = new Database(dbPath);
		log.info(`Initialized SQLite database at ${dbPath}`);
	}
	return db;
}

/**
 * Create the database context object.
 *
 * This object is assigned to ctx.db and provides:
 * - register(namespace, initFn) - Register a feature's database namespace
 * - connection - Raw database connection (for advanced use)
 * - close() - Close the database connection
 *
 * Features register their namespaces, which become accessible as ctx.db.[namespace].
 *
 * @returns {object} Database context object
 *
 * @example
 * // In music-stats/index.js:
 * ctx.db.register("music", (db) => ({
 *     recordPlay: (data) => { ... },
 *     getTopVideos: (guildId) => { ... },
 * }));
 *
 * // In another feature:
 * ctx.db.music.recordPlay({ ... });
 */
function createDatabaseContext() {
	const connection = getConnection();

	const dbContext = {
		/**
		 * Register a feature's database namespace.
		 *
		 * The init function receives the raw database connection and should:
		 * 1. Create any required tables
		 * 2. Return an object with query functions
		 *
		 * The returned object becomes accessible at ctx.db.[namespace].
		 *
		 * @param {string} namespace - Unique namespace for the feature
		 * @param {function(Database.Database): object} initFn - Initialization function
		 */
		register(namespace, initFn) {
			if (this[namespace]) {
				log.warn(`Database namespace '${namespace}' already registered, overwriting`);
			}

			log.debug(`Registering database namespace: ${namespace}`);
			const namespaceApi = initFn(connection);
			this[namespace] = namespaceApi;
			log.info(`Registered database namespace: ${namespace}`);
		},

		/**
		 * Raw database connection for advanced use.
		 * Prefer using namespaced methods when possible.
		 * @type {Database.Database}
		 */
		get connection() {
			return connection;
		},

		/**
		 * Close the database connection.
		 * Called during graceful shutdown.
		 */
		close() {
			if (db) {
				db.close();
				db = null;
				log.info("Closed database connection");
			}
		},
	};

	return dbContext;
}

module.exports = {
	createDatabaseContext,
	getConnection,
};
