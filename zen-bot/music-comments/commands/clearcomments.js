/**
 * Clear comments command - clears all track comments for a guild.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("clearcomments");

module.exports = {
	name: "clearvideos",
	aliases: ["clearcomments"],
	permissions: ["Administrator"],

	async execute(message, args, ctx) {
		if (!message.member.permissions.has("Administrator")) {
			log.debug("Clearcomments refused: user lacks Administrator (guild:", message.guild.id, ")");
			return message.reply("🛑 You need the 'Administrator' permission to use this command.");
		}

		const guildId = message.guild.id;
		log.info("Clearing all track comments for guild:", guildId);

		try {
			const commentsDeleted = ctx.db.music.clearTrackComments(guildId);
			const reactionsDeleted = ctx.db.music.clearTrackReactions(guildId);
			log.info("Cleared", commentsDeleted, "comments and", reactionsDeleted, "reactions for guild:", guildId, ")");
			const parts = [];
			if (commentsDeleted) parts.push(`${commentsDeleted} comment${commentsDeleted !== 1 ? "s" : ""}`);
			if (reactionsDeleted) parts.push(`${reactionsDeleted} reaction${reactionsDeleted !== 1 ? "s" : ""}`);
			const msg = parts.length ? `✅ Cleared ${parts.join(" and ")} for this server.` : "✅ No track comments or reactions to clear.";
			return message.reply(msg);
		} catch (e) {
			log.error("Failed to clear track comments/reactions:", e);
			return message.reply(`Failed to clear: ${e.message}`);
		}
	},
};
