/**
 * Clear video command - clears comments for the currently playing track.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("clearvideo");

module.exports = {
	name: "clearvideo",
	permissions: ["Administrator"],

	async execute(message, args, ctx) {
		if (!message.member.permissions.has("Administrator")) {
			log.debug("Clearvideo refused: user lacks Administrator (guild:", message.guild.id, ")");
			return message.reply("🛑 You need the 'Administrator' permission to use this command.");
		}

		if (!message.reference?.messageId) {
			log.debug("Clearvideo refused: not a reply (guild:", message.guild.id, ")");
			return message.reply("🛑 Reply to an enqueued message with `#clearvideo` to clear comments for that video.");
		}

		const guildId = message.guild.id;
		const session = ctx.services.comments.getActiveSession(guildId);

		if (!session || message.reference.messageId !== session.messageId) {
			log.debug("Clearvideo refused: reply not to current track enqueued message (guild:", guildId, ")");
			return message.reply("🛑 Reply to the currently playing track's enqueued message to clear its comments.");
		}

		log.info("Clearing comments for video (guild:", guildId, "url:", session.trackUrl?.slice(0, 50), "...)");
		try {
			const deletedCount = ctx.db.music.clearVideoComments(session.trackUrl, guildId);
			log.info("Cleared", deletedCount, "comments for video (guild:", guildId, ")");
			return message.reply(`✅ Cleared ${deletedCount} comment${deletedCount !== 1 ? "s" : ""} for this video.`);
		} catch (e) {
			log.error("Failed to clear video comments:", e);
			return message.reply(`Failed to clear video comments: ${e.message}`);
		}
	},
};
