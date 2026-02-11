/**
 * Musicstats command - shows play statistics.
 */

const { MessageFlagsBitField } = require("discord.js");
const { createLogger } = require("../../core/logger");

const log = createLogger("musicstats");

/**
 * Truncate a title to a maximum length.
 */
function truncateTitle(title, maxLength) {
	if (title.length <= maxLength) return title;
	return title.slice(0, maxLength - 3) + "...";
}

module.exports = {
	name: "musicstats",

	async execute(message, args, ctx) {
		const guildId = message.guild.id;
		const userId = message.author.id;

		try {
			const { music } = ctx.db;

			// Get stats
			const topOverall = music.getTopVideosOverall(guildId, 10);
			const topByUser = music.getTopVideosByUser(guildId, userId, 10);
			const topListeners = music.getTopListeners(guildId, 10);
			const totalPlays = music.getTotalPlays(guildId);
			const userTotalPlays = music.getUserTotalPlays(guildId, userId);

			// Build the response
			let response = "📊 **Music Stats**\n\n";

			// Overall stats
			response += `**Total plays on this server:** ${totalPlays}\n`;
			response += `**Your total plays:** ${userTotalPlays}\n\n`;

			// Top listeners
			response += "👂 **Top 10 Listeners (Server)**\n";
			if (topListeners.length === 0) {
				response += "_No plays recorded yet!_\n";
			} else {
				topListeners.forEach((entry, index) => {
					response += `${index + 1}. **${entry.user_name}** — ${entry.play_count} play${entry.play_count !== 1 ? "s" : ""}\n`;
				});
			}

			response += "\n";

			// Top 10 overall
			response += "🏆 **Top 10 Most Played (Server)**\n";
			if (topOverall.length === 0) {
				response += "_No plays recorded yet!_\n";
			} else {
				topOverall.forEach((entry, index) => {
					const title = truncateTitle(entry.video_title, 50);
					response += `${index + 1}. [**${title}**](${entry.video_url}) — ${entry.play_count} play${entry.play_count !== 1 ? "s" : ""}\n`;
				});
			}

			response += "\n";

			// Top 10 by user
			response += `🎵 **Your Top 10 Most Played**\n`;
			if (topByUser.length === 0) {
				response += "_You haven't played anything yet!_\n";
			} else {
				topByUser.forEach((entry, index) => {
					const title = truncateTitle(entry.video_title, 50);
					response += `${index + 1}. [**${title}**](${entry.video_url}) — ${entry.play_count} play${entry.play_count !== 1 ? "s" : ""}\n`;
				});
			}

			return message.reply({ content: response, flags: MessageFlagsBitField.Flags.SuppressEmbeds });
		} catch (e) {
			log.error("Failed to get music stats:", e);
			return message.reply(`Failed to get music stats: ${e.message}`);
		}
	},
};
