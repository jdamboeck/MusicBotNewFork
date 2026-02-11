/**
 * Command loader - scans feature directories for commands.
 */

const fs = require("fs");
const path = require("path");
const { createLogger } = require("../logger");

const log = createLogger("commands");

/**
 * Load all commands from feature directories.
 * Scans zen-bot/[feature]/commands/[command].js for command files.
 * @returns {Map<string, object>} Map of command name to command object
 */
function loadCommands() {
	const commands = new Map();
	const zenBotDir = path.join(__dirname, "..", "..");

	// Get all feature directories
	const features = fs.readdirSync(zenBotDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && d.name !== "node_modules")
		.map((d) => d.name);

	for (const feature of features) {
		const commandsDir = path.join(zenBotDir, feature, "commands");

		if (!fs.existsSync(commandsDir)) continue;

		const files = fs.readdirSync(commandsDir)
			.filter((f) => f.endsWith(".js") && f !== "index.js");

		for (const file of files) {
			try {
				const command = require(path.join(commandsDir, file));

				if (!command.name || typeof command.execute !== "function") {
					log.warn(`Skipping ${feature}/commands/${file}: missing name or execute`);
					continue;
				}

				commands.set(command.name, command);

				// Register aliases
				if (Array.isArray(command.aliases)) {
					for (const alias of command.aliases) {
						commands.set(alias, command);
					}
				}

				log.debug(`Loaded command: ${command.name} from ${feature}`);
			} catch (err) {
				log.error(`Failed to load ${feature}/commands/${file}:`, err.message);
			}
		}
	}

	log.info(`Loaded ${commands.size} commands`);
	return commands;
}

module.exports = { loadCommands };
