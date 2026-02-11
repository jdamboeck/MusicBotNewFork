/**
 * Example Feature Configuration
 *
 * This file demonstrates the configuration pattern for zen-bot features.
 *
 * PATTERN:
 * - Define sensible defaults
 * - Allow environment variable overrides
 * - Export a plain object (no classes, no singletons)
 *
 * NAMING CONVENTION:
 * Environment variables should be prefixed with the feature name in SCREAMING_SNAKE_CASE:
 * - EXAMPLE_GREETING
 * - EXAMPLE_MAX_GREETINGS
 * - EXAMPLE_COOLDOWN_MS
 *
 * @module zen-bot/example/config
 */

module.exports = {
	// ─────────────────────────────────────────────────────────────────────────
	// STRING CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// Simple string with fallback default

	/**
	 * Greeting message used by the greet command.
	 * @type {string}
	 * @env EXAMPLE_GREETING
	 * @default "Hello"
	 */
	greeting: process.env.EXAMPLE_GREETING || "Hello",

	// ─────────────────────────────────────────────────────────────────────────
	// NUMERIC CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// Parse integers with parseInt, provide default via || or ??

	/**
	 * Maximum greetings before the bot gets tired.
	 * @type {number}
	 * @env EXAMPLE_MAX_GREETINGS
	 * @default 100
	 */
	maxGreetings: parseInt(process.env.EXAMPLE_MAX_GREETINGS, 10) || 100,

	/**
	 * Cooldown between greetings in milliseconds.
	 * @type {number}
	 * @env EXAMPLE_COOLDOWN_MS
	 * @default 5000
	 */
	cooldownMs: parseInt(process.env.EXAMPLE_COOLDOWN_MS, 10) || 5000,

	// ─────────────────────────────────────────────────────────────────────────
	// BOOLEAN CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// For booleans, check explicitly for "false" or "true" strings

	/**
	 * Whether the feature is enabled.
	 * Set to "false" to disable.
	 * @type {boolean}
	 * @env EXAMPLE_ENABLED
	 * @default true
	 */
	featureEnabled: process.env.EXAMPLE_ENABLED !== "false",

	/**
	 * Whether to log verbose debug information.
	 * Must be explicitly set to "true" to enable.
	 * @type {boolean}
	 * @env EXAMPLE_VERBOSE
	 * @default false
	 */
	verbose: process.env.EXAMPLE_VERBOSE === "true",

	// ─────────────────────────────────────────────────────────────────────────
	// ARRAY/LIST CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// Split comma-separated strings into arrays

	/**
	 * List of special greetings to use randomly.
	 * Comma-separated in environment variable.
	 * @type {string[]}
	 * @env EXAMPLE_SPECIAL_GREETINGS
	 * @default ["Howdy", "Hey there", "Greetings"]
	 */
	specialGreetings: process.env.EXAMPLE_SPECIAL_GREETINGS
		? process.env.EXAMPLE_SPECIAL_GREETINGS.split(",").map((s) => s.trim())
		: ["Howdy", "Hey there", "Greetings"],

	// ─────────────────────────────────────────────────────────────────────────
	// COMPUTED CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// Derive values from other config or environment

	/**
	 * Cooldown in human-readable format.
	 * Computed from cooldownMs.
	 * @type {string}
	 */
	get cooldownFormatted() {
		const ms = this.cooldownMs;
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	},
};
