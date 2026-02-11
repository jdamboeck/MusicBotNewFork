/**
 * Core feature - Discord client, command registry, services, database.
 */

const { Client, GatewayIntentBits } = require("discord.js");
const { createLogger } = require("./logger");
const config = require("./config");
const { loadCommands } = require("./commands");
const { createDatabaseContext } = require("./database");
const activity = require("./services/activity");
const soundboard = require("./services/soundboard");

const log = createLogger("core");

/**
 * Initialize the core feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing core...");
	log.debug("Config: prefix =", config.prefix);

	// Create Discord client
	ctx.client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildVoiceStates,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.MessageContent,
		],
	});

	// Initialize database context (features register their namespaces)
	ctx.db = createDatabaseContext();

	// Load commands from all features
	ctx.commands = loadCommands();

	// Export services for other features
	ctx.services = {
		activity,
		soundboard,
	};

	// Store config for other features
	ctx.config = config;

	log.info("Core initialized");
}

module.exports = { init };
