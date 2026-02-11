/**
 * Clear command - bulk delete messages from a channel.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("clear");

module.exports = {
	name: "clear",
	permissions: ["ManageMessages"],

	async execute(message, args, ctx) {
		// Check if user has permission to manage messages
		if (!message.member.permissionsIn(message.channel).has("ManageMessages")) {
			log.debug("Clear refused: user lacks ManageMessages (guild:", message.guild.id, ")");
			return message.reply("🛑 You need the 'Manage Messages' permission to use this command.");
		}

		// Check if bot has permission to manage messages
		if (!message.guild.members.me.permissionsIn(message.channel).has("ManageMessages")) {
			log.debug("Clear refused: bot lacks ManageMessages in channel (guild:", message.guild.id, ")");
			return message.reply("🛑 I don't have permission to delete messages in this channel.");
		}

		const amount = parseInt(args[0]) || 100;
		const deleteCount = Math.max(amount, 1);
		log.info("Clear requested: up to", deleteCount, "messages in channel", message.channel.id, "(guild:", message.guild.id, ")");

		try {
			const statusMsg = await message.channel.send(`🗑️ Clearing messages...`);
			let totalDeleted = 0;
			let remaining = deleteCount;

			// 14 days in milliseconds
			const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

			while (remaining > 0) {
				const fetchCount = Math.min(remaining, 100);
				const messages = await message.channel.messages.fetch({ limit: fetchCount });

				if (messages.size === 0) break;

				const toDelete = messages.filter((m) => m.id !== statusMsg.id);
				if (toDelete.size === 0) break;

				// Separate messages into recent (< 14 days) and old (>= 14 days)
				const recentMessages = [];
				const oldMessages = [];

				for (const [id, msg] of toDelete) {
					if (msg.createdTimestamp > fourteenDaysAgo) {
						recentMessages.push(msg);
					} else {
						oldMessages.push(msg);
					}
				}

				// Bulk delete recent messages (if more than 1)
				if (recentMessages.length > 1) {
					const deleted = await message.channel.bulkDelete(recentMessages, true);
					totalDeleted += deleted.size;
					remaining -= deleted.size;
				} else if (recentMessages.length === 1) {
					await recentMessages[0].delete();
					totalDeleted++;
					remaining--;
				}

				// Delete old messages individually with rate limit handling
				for (const msg of oldMessages) {
					if (remaining <= 0) break;
					try {
						await msg.delete();
						totalDeleted++;
						remaining--;
						// Small delay to avoid rate limits
						await new Promise((resolve) => setTimeout(resolve, 300));
					} catch (e) {
						// Skip if message already deleted
						if (e.code !== 10008) log.error(`Failed to delete message:`, e.message);
					}
				}

				// Update status periodically
				await statusMsg.edit(`🗑️ Clearing messages... (${totalDeleted} deleted)`).catch(() => {});

				// If we fetched fewer messages than requested, we've hit the end
				if (messages.size < fetchCount) break;
			}

			log.info("Clear completed: deleted", totalDeleted, "messages (channel:", message.channel.id, "guild:", message.guild.id, ")");
			await statusMsg.edit(`🗑️ Cleared ${totalDeleted} messages.`);
			// Auto-delete the confirmation after 3 seconds
			setTimeout(() => statusMsg.delete().catch(() => {}), 3000);
		} catch (e) {
			log.error("Failed to clear messages:", e);
			return message.reply(`Failed to clear messages: ${e.message}`);
		}
	},
};
