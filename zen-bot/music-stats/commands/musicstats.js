/**
 * Musicstats command - shows play statistics.
 * Video list: only clickable buttons (no line above); below each button a bold plays line.
 */

const { MessageFlagsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createLogger } = require("../../core/logger");
const playButtonStore = require("../playButtonStore");

const log = createLogger("musicstats");

const PLAY_ICON = "▶️";

/** Mathematical bold Unicode block: 0-9 → U+1D7CE–1D7D7, A-Z → U+1D400–1D419, a-z → U+1D41A–1D433. */
const BOLD_DIGIT_0 = 0x1d7ce;
const BOLD_A = 0x1d400;
const BOLD_A_LOWER = 0x1d41a;

function toBoldUnicode(str) {
	let out = "";
	for (const c of str) {
		const code = c.codePointAt(0);
		if (code >= 0x30 && code <= 0x39) out += String.fromCodePoint(BOLD_DIGIT_0 + (code - 0x30));
		else if (code >= 0x41 && code <= 0x5a) out += String.fromCodePoint(BOLD_A + (code - 0x41));
		else if (code >= 0x61 && code <= 0x7a) out += String.fromCodePoint(BOLD_A_LOWER + (code - 0x61));
		else out += c;
	}
	return out;
}

/**
 * Truncate a title to a maximum length.
 */
function truncateTitle(title, maxLength) {
	if (title.length <= maxLength) return title;
	return title.slice(0, maxLength - 3) + "...";
}

/** Discord button label max length. */
const BUTTON_LABEL_MAX = 80;

/** Title length in button (with leading space + "▶️ N. " prefix we stay under 80). */
const BUTTON_TITLE_LENGTH = 70;

/**
 * One play button (index 0) for a single-line message; store resolves URL by message id.
 * Label: leading space, number, bold title (Unicode).
 */
function buildSinglePlayButton(label) {
	const safeLabel = label.length > BUTTON_LABEL_MAX ? label.slice(0, BUTTON_LABEL_MAX - 3) + "..." : label;
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("musicstats_play_0")
				.setLabel(safeLabel)
				.setStyle(ButtonStyle.Secondary),
		),
	];
}

/**
 * Send one message per video: button only (no line above), then a line below with bold plays.
 */
async function sendVideoLines(channel, entries, flags, delayMs = 150) {
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const titleBold = toBoldUnicode(truncateTitle(entry.video_title, BUTTON_TITLE_LENGTH));
		const buttonLabel = ` ${PLAY_ICON} ${i + 1}. ${titleBold}`;
		const sent = await channel.send({
			content: "\u200B",
			flags,
			components: buildSinglePlayButton(buttonLabel),
		});
		playButtonStore.set(sent.id, [entry.video_url]);
		const playsText = entry.play_count === 1 ? "1 play" : `${entry.play_count} plays`;
		await channel.send({ content: `**${playsText}**`, flags });
		if (delayMs > 0 && i < entries.length - 1) {
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
}

module.exports = {
	name: "musicstats",

	async execute(message, args, ctx) {
		const guildId = message.guild.id;
		const userId = message.author.id;
		log.debug("Musicstats requested (guild:", guildId, "user:", message.author.username, ")");

		try {
			const { music } = ctx.db;

			// Get stats
			const topOverall = music.getTopVideosOverall(guildId, 10);
			const topByUser = music.getTopVideosByUser(guildId, userId, 10);
			const topListeners = music.getTopListeners(guildId, 10);
			const totalPlays = music.getTotalPlays(guildId);
			const userTotalPlays = music.getUserTotalPlays(guildId, userId);

			const flags = MessageFlagsBitField.Flags.SuppressEmbeds;

			// Single intro message: header, stats, top listeners, no video list
			let response = "📊 **Music Stats**\n\n";
			response += `**Total plays on this server:** ${totalPlays}\n`;
			response += `**Your total plays:** ${userTotalPlays}\n\n`;
			response += "👂 **Top 10 Listeners (Server)**\n";
			if (topListeners.length === 0) {
				response += "_No plays recorded yet!_\n";
			} else {
				topListeners.forEach((entry, index) => {
					response += `${index + 1}. **${entry.user_name}** — ${entry.play_count} play${entry.play_count !== 1 ? "s" : ""}\n`;
				});
			}

			const first = await message.reply({ content: response, flags });

			// Section: only clickable buttons, then a bold plays line below each (no line above button)
			if (topOverall.length > 0) {
				await first.channel.send({ content: "🏆 **Top 10 Most Played (Server)**", flags });
				await sendVideoLines(first.channel, topOverall, flags);
			} else {
				await first.channel.send({
					content: "🏆 **Top 10 Most Played (Server)**\n_No plays recorded yet!_",
					flags,
				});
			}

			if (topByUser.length > 0) {
				await first.channel.send({ content: "🎵 **Your Top 10 Most Played**", flags });
				await sendVideoLines(first.channel, topByUser, flags);
			} else {
				await first.channel.send({
					content: "🎵 **Your Top 10 Most Played**\n_You haven't played anything yet!_",
					flags,
				});
			}

			log.info("Musicstats sent (guild:", guildId, "totalPlays:", totalPlays, ")");
			return first;
		} catch (e) {
			log.error("Failed to get music stats:", e);
			return message.reply(`Failed to get music stats: ${e.message}`);
		}
	},
};
