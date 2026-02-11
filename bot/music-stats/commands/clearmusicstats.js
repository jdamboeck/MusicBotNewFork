/**
 * Clear music stats command - clears all play history for a guild.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("clearmusicstats");

module.exports = {
	name: "clearmusicstats",
	permissions: ["Administrator"],

	async execute(message, args, ctx) {
		// Check if user has administrator permission
		if (!message.member.permissions.has("Administrator")) {
			return message.reply("🛑 You need the 'Administrator' permission to use this command.");
		}

		const guildId = message.guild.id;

		try {
			const deletedCount = ctx.db.clearMusicStats(guildId);
			return message.reply(`✅ Cleared ${deletedCount} music stats record${deletedCount !== 1 ? "s" : ""} for this server.`);
		} catch (e) {
			log.error("Failed to clear music stats:", e);
			return message.reply(`Failed to clear music stats: ${e.message}`);
		}
	},
};
