/**
 * Message create event handler - routes prefix commands.
 */

const { createLogger } = require("../logger");
const config = require("../config");

const log = createLogger("commands");

module.exports = {
	event: "messageCreate",
	target: "client",

	/**
	 * Handle message create event - dispatch prefix commands.
	 * @param {import("discord.js").Message} message
	 * @param {object} ctx - Shared context
	 * @returns {boolean} True if message was handled as a command
	 */
	async handle(message, ctx) {
		// Ignore bot messages
		if (message.author.bot) return false;

		// Check for command prefix
		if (!message.content.startsWith(config.prefix)) return false;

		const args = message.content.slice(config.prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		log.debug(`Command: ${commandName}, Args: ${args.join(" ")}`);

		const command = ctx.commands.get(commandName);
		if (!command) {
			log.debug(`Unknown command: ${commandName}`);
			return false;
		}

		log.info(`Executing command: ${commandName} (by ${message.author.username})`);
		try {
			await command.execute(message, args, ctx);
		} catch (err) {
			log.error(`Error executing ${commandName}:`, err);
			message.reply(`Something went wrong: ${err.message}`).catch(() => {});
		}

		return true;
	},
};
