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

		log.info("Clearing comments and reactions for video (guild:", guildId, "url:", session.trackUrl?.slice(0, 50), "...)");
		try {
			const commentsDeleted = ctx.db.music.clearVideoComments(session.trackUrl, guildId);
			const reactionsDeleted = ctx.db.music.clearVideoReactions(session.trackUrl, guildId);
			log.info("Cleared", commentsDeleted, "comments and", reactionsDeleted, "reactions for video (guild:", guildId, ")");
			const parts = [];
			if (commentsDeleted) parts.push(`${commentsDeleted} comment${commentsDeleted !== 1 ? "s" : ""}`);
			if (reactionsDeleted) parts.push(`${reactionsDeleted} reaction${reactionsDeleted !== 1 ? "s" : ""}`);
			const msg = parts.length ? `✅ Cleared ${parts.join(" and ")} for this video.` : "✅ No comments or reactions to clear for this video.";
			return message.reply(msg);
		} catch (e) {
			log.error("Failed to clear video comments/reactions:", e);
			return message.reply(`Failed to clear: ${e.message}`);
		}
	},
};
