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
			return message.reply("🛑 You need the 'Administrator' permission to use this command.");
		}

		const guildId = message.guild.id;

		try {
			const deletedCount = ctx.db.clearTrackComments(guildId);
			return message.reply(`✅ Cleared ${deletedCount} track comment${deletedCount !== 1 ? "s" : ""} for this server.`);
		} catch (e) {
			log.error("Failed to clear track comments:", e);
			return message.reply(`Failed to clear track comments: ${e.message}`);
		}
	},
};
