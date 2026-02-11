/**
 * Example Feature - Demonstrates all zen-bot patterns.
 *
 * This feature serves as a reference implementation showing:
 * - Feature initialization with the context object
 * - Configuration with environment variable overrides
 * - Creating and exposing services
 * - Registering a database namespace (ctx.db.example)
 * - Logging with prefixed loggers
 * - Inter-feature dependencies
 *
 * FEATURE DEPENDENCIES:
 * This feature depends on:
 * - core (for client, commands, services.activity, database)
 *
 * Ensure this feature is listed AFTER core in FEATURE_ORDER.
 *
 * @module zen-bot/example
 */

const { createLogger } = require("../core/logger");
const config = require("./config");
const services = require("./services");
const { initExampleDatabase } = require("./database");

// Create a logger for this feature.
// The prefix appears in all log output: [example] message
const log = createLogger("example");

/**
 * Initialize the example feature.
 *
 * This function is called by the feature loader (bot/index.js) during startup.
 * It receives the shared context object containing resources from previously
 * loaded features.
 *
 * @param {object} ctx - Shared context object
 * @param {import('discord.js').Client} ctx.client - Discord.js client (from core)
 * @param {import('discord-player').Player} ctx.player - discord-player instance (from music)
 * @param {object} ctx.db - Database context with namespaced access (from core)
 * @param {Map} ctx.commands - Command registry (from core)
 * @param {object} ctx.services - Shared services from all features
 * @param {object} ctx.config - Core configuration (token, prefix)
 */
async function init(ctx) {
	log.info("Initializing example feature...");

	// ─────────────────────────────────────────────────────────────────────────
	// ACCESSING DEPENDENCIES
	// ─────────────────────────────────────────────────────────────────────────
	// Features loaded before this one have already added their exports to ctx.
	// Check for required dependencies and fail early if missing.

	if (!ctx.client) {
		throw new Error("Example feature requires core feature (ctx.client missing)");
	}

	if (!ctx.db) {
		throw new Error("Example feature requires core feature (ctx.db missing)");
	}

	// ─────────────────────────────────────────────────────────────────────────
	// DATABASE NAMESPACE REGISTRATION
	// ─────────────────────────────────────────────────────────────────────────
	// Register this feature's database namespace.
	// This creates ctx.db.example with all our query functions.
	// See database.js for the implementation.

	ctx.db.register("example", initExampleDatabase);

	// Now we can use ctx.db.example.saveGreeting(), ctx.db.example.getGreetingCount(), etc.

	// ─────────────────────────────────────────────────────────────────────────
	// CONFIGURATION
	// ─────────────────────────────────────────────────────────────────────────
	// Feature-specific config is loaded from ./config.js
	// All settings have defaults that can be overridden via environment variables

	log.debug("Configuration loaded:", {
		greeting: config.greeting,
		maxGreetings: config.maxGreetings,
		cooldownMs: config.cooldownMs,
		featureEnabled: config.featureEnabled,
	});

	// Expose config to other features if they need it
	ctx.exampleConfig = config;

	// ─────────────────────────────────────────────────────────────────────────
	// SERVICES
	// ─────────────────────────────────────────────────────────────────────────
	// Services are stateful modules that provide functionality to commands,
	// events, and other features.
	//
	// Initialize services that need the context object
	services.init(ctx);

	// Expose services for other features to use
	// Convention: ctx.services.[featureName]
	ctx.services.example = {
		// Export public service methods
		greet: services.greet,
		getGreetCount: services.getGreetCount,
		resetGreetCount: services.resetGreetCount,
	};

	// ─────────────────────────────────────────────────────────────────────────
	// FEATURE-SPECIFIC INITIALIZATION
	// ─────────────────────────────────────────────────────────────────────────
	// Perform any one-time setup your feature needs

	// Example: Log when the bot is ready
	ctx.client.once("ready", () => {
		log.info(`Example feature active! Greeting: "${config.greeting}"`);
	});

	log.info("Example feature initialized (ctx.db.example available)");
}

// Export the init function - this is required for all features
module.exports = { init };
