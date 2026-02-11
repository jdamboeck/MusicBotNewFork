/**
 * ResetGreet Command - Resets your greeting counter.
 *
 * Demonstrates:
 * - Commands that modify state
 * - Simple confirmation responses
 *
 * @module zen-bot/example/commands/resetgreet
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("resetgreet");

module.exports = {
	name: "resetgreet",
	aliases: ["rg"],

	/**
	 * Execute the command.
	 *
	 * @param {import('discord.js').Message} message
	 * @param {string[]} args
	 * @param {object} ctx
	 */
	async execute(message, args, ctx) {
		const { example } = ctx.services;

		if (!example) {
			return message.reply("Greet feature not available.");
		}

		const guildId = message.guild?.id;

		// Get current count before reset (from database)
		const previousCount = example.getGreetCount(message.author.id, guildId);

		if (previousCount === 0) {
			return message.reply("Your greet count is already 0.");
		}

		// Reset the count (clears database and in-memory state)
		example.resetGreetCount(message.author.id, guildId);

		log.info(`${message.author.username} reset their greet count from ${previousCount}`);

		return message.reply(`Reset your greet count from **${previousCount}** to **0**.`);
	},
};
