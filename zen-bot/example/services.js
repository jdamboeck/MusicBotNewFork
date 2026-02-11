/**
 * Example Feature Services
 *
 * Services are stateful modules that provide shared functionality.
 * They can be used by commands, events, and other features.
 *
 * PATTERN:
 * - Export functions that encapsulate business logic
 * - Keep state private within the module
 * - Initialize with context if needed via init()
 * - Expose clean, simple APIs
 *
 * WHEN TO USE SERVICES:
 * - Shared state that multiple commands/events need
 * - Complex logic that shouldn't live in commands
 * - Functionality that other features might want to use
 *
 * @module zen-bot/example/services
 */

const { createLogger } = require("../core/logger");
const config = require("./config");

const log = createLogger("example-service");

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE STATE
// ─────────────────────────────────────────────────────────────────────────────
// Module-level state is private and only accessible through exported functions

/**
 * Greeting counter per user.
 * @type {Map<string, number>}
 */
const greetCounts = new Map();

/**
 * Cooldown tracker per user.
 * @type {Map<string, number>}
 */
const cooldowns = new Map();

/**
 * Reference to the shared context (set during init).
 * @type {object|null}
 */
let ctx = null;

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize services with the shared context.
 *
 * Call this from the feature's init() function if your services
 * need access to other features (client, player, db, etc).
 *
 * @param {object} context - Shared context object
 */
function init(context) {
	ctx = context;
	log.debug("Services initialized with context");
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC SERVICE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Greet a user with the configured greeting.
 *
 * Demonstrates:
 * - Using feature configuration
 * - Managing per-user state (in-memory for cooldowns)
 * - Persisting data to database
 * - Cooldown enforcement
 * - Returning structured results
 *
 * @param {string} userId - Discord user ID
 * @param {string} userName - User's display name
 * @param {string} guildId - Guild ID (for database storage)
 * @returns {{ success: boolean, message: string, count?: number }}
 */
function greet(userId, userName, guildId) {
	// Check if feature is enabled
	if (!config.featureEnabled) {
		return { success: false, message: "Greeting feature is disabled" };
	}

	// Check cooldown (in-memory for fast access)
	const lastGreet = cooldowns.get(userId) || 0;
	const now = Date.now();
	const elapsed = now - lastGreet;

	if (elapsed < config.cooldownMs) {
		const remaining = Math.ceil((config.cooldownMs - elapsed) / 1000);
		log.debug(`User ${userName} is on cooldown (${remaining}s remaining)`);
		return {
			success: false,
			message: `Please wait ${remaining}s before greeting again`,
		};
	}

	// Get count from database (persistent across restarts)
	let count = 0;
	if (ctx?.db?.example && guildId) {
		count = ctx.db.example.getGreetingCount(userId, guildId);
	} else {
		// Fallback to in-memory if no database
		count = greetCounts.get(userId) || 0;
	}
	count += 1;

	// Check max greetings
	if (count > config.maxGreetings) {
		log.debug(`User ${userName} exceeded max greetings`);
		return {
			success: false,
			message: "You've greeted too many times! Give the bot a break.",
		};
	}

	// Generate greeting message
	const greeting = getRandomGreeting();
	const greetingMessage = `${greeting}, ${userName}! (Greeting #${count})`;

	// Save to database (persistent) and update in-memory state
	if (ctx?.db?.example && guildId) {
		ctx.db.example.saveGreeting({
			userId,
			userName,
			guildId,
			greetingText: greetingMessage,
		});
	}
	greetCounts.set(userId, count);
	cooldowns.set(userId, now);

	log.info(`Greeted ${userName} (count: ${count})`);

	return {
		success: true,
		message: greetingMessage,
		count,
	};
}

/**
 * Get a random greeting from the configured list.
 *
 * @returns {string}
 */
function getRandomGreeting() {
	const greetings = [config.greeting, ...config.specialGreetings];
	return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Get the greeting count for a user.
 *
 * @param {string} userId - Discord user ID
 * @param {string} [guildId] - Guild ID (uses database if provided)
 * @returns {number}
 */
function getGreetCount(userId, guildId) {
	// Prefer database if available
	if (ctx?.db?.example && guildId) {
		return ctx.db.example.getGreetingCount(userId, guildId);
	}
	// Fallback to in-memory
	return greetCounts.get(userId) || 0;
}

/**
 * Reset the greeting count for a user.
 *
 * @param {string} userId - Discord user ID
 * @param {string} [guildId] - Guild ID (clears database if provided)
 * @returns {number} Number of deleted records (0 if in-memory only)
 */
function resetGreetCount(userId, guildId) {
	let deleted = 0;

	// Clear from database if available
	if (ctx?.db?.example && guildId) {
		deleted = ctx.db.example.clearUserGreetings(userId, guildId);
	}

	// Always clear in-memory state
	greetCounts.delete(userId);
	cooldowns.delete(userId);
	log.debug(`Reset greet count for user ${userId} (deleted ${deleted} from db)`);

	return deleted;
}

/**
 * Get the shared context (for advanced use cases).
 *
 * @returns {object|null}
 */
function getContext() {
	return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
	// Initialization
	init,

	// Core service functions
	greet,
	getGreetCount,
	resetGreetCount,

	// Utilities (optional - expose if other features need them)
	getRandomGreeting,
	getContext,
};
