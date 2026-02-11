/**
 * GreetCount Command - Shows how many times you've been greeted.
 *
 * Demonstrates:
 * - Accessing other user's data via mentions
 * - Using ctx.db for database queries (when available)
 * - Conditional logic based on feature availability
 *
 * @module zen-bot/example/commands/greetcount
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("greetcount");

module.exports = {
	name: "greetcount",
	aliases: ["gc"],

	/**
	 * Execute the command.
	 *
	 * @param {import('discord.js').Message} message
	 * @param {string[]} args - Optional: mention a user to see their count
	 * @param {object} ctx
	 */
	async execute(message, args, ctx) {
		const { example } = ctx.services;

		if (!example) {
			return message.reply("Greet feature not available.");
		}

		// ───────────────────────────────────────────────────────────────────────
		// HANDLE MENTIONS
		// ───────────────────────────────────────────────────────────────────────
		// Check if user mentioned someone else

		const mentioned = message.mentions.users.first();
		const targetUser = mentioned || message.author;
		const isSelf = targetUser.id === message.author.id;

		// ───────────────────────────────────────────────────────────────────────
		// GET DATA AND RESPOND
		// ───────────────────────────────────────────────────────────────────────
		// Pass guildId to get persistent count from database

		const count = example.getGreetCount(targetUser.id, message.guild?.id);

		if (isSelf) {
			if (count === 0) {
				return message.reply("You haven't been greeted yet! Try `#greet`.");
			}
			return message.reply(`You've been greeted **${count}** times.`);
		}

		if (count === 0) {
			return message.reply(`${targetUser.username} hasn't been greeted yet.`);
		}
		return message.reply(`${targetUser.username} has been greeted **${count}** times.`);
	},
};
