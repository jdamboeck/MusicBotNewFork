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
			log.debug("Clearmusicstats refused: user lacks Administrator (guild:", message.guild.id, ")");
			return message.reply("🛑 You need the 'Administrator' permission to use this command.");
		}

		const guildId = message.guild.id;
		log.info("Clearing music stats for guild:", guildId);

		try {
			const deletedCount = ctx.db.music.clearMusicStats(guildId);
			log.info("Cleared", deletedCount, "music stats records (guild:", guildId, ")");
			return message.reply(`✅ Cleared ${deletedCount} music stats record${deletedCount !== 1 ? "s" : ""} for this server.`);
		} catch (e) {
			log.error("Failed to clear music stats:", e);
			return message.reply(`Failed to clear music stats: ${e.message}`);
		}
	},
};
