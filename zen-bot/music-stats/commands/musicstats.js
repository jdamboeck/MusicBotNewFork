/**
 * Musicstats command - shows play statistics.
 * Uses Discord v2 display components (Container, TextDisplay, Section, Separator).
 */

const {
	MessageFlags,
	TextDisplayBuilder,
	SectionBuilder,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { createLogger } = require("../../core/logger");
const playButtonStore = require("../playButtonStore");

const log = createLogger("musicstats");

const PLAY_ICON = "▶️ ";

/** Discord button label max length. */
const BUTTON_LABEL_MAX = 7;

/** Title length in button (with leading space + "▶️ N. " prefix we stay under 80). */
const BUTTON_TITLE_LENGTH = 55;

/**
 * Truncate a title to a maximum length.
 */
function truncateTitle(title, maxLength) {
	if (title.length <= maxLength) return title;
	return title.slice(0, maxLength - 3) + "...";
}

/**
 * Build Section components for video entries.
 * Each Section has a TextDisplay with play count and a Button accessory.
 * @param {Array} entries - Video entries with video_title, video_url, play_count
 * @param {number} startIndex - Starting index for button customId
 * @returns {Array} Array of SectionBuilder components
 */
function buildVideoSections(entries, startIndex) {
	const sections = [];
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const title = truncateTitle(entry.video_title, BUTTON_TITLE_LENGTH);
		const buttonLabel = ` ${PLAY_ICON} ${startIndex + i + 1}. ${title}`;
		const safeLabel = buttonLabel.length > BUTTON_LABEL_MAX ? buttonLabel.slice(0, BUTTON_LABEL_MAX - 3) + "..." : buttonLabel;
		const playsText = entry.play_count === 1 ? "1 play" : `${entry.play_count} plays`;

		const section = new SectionBuilder()
			.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`**${playsText}**`))
			.setButtonAccessory((button) =>
				button
					.setCustomId(`musicstats_play_${startIndex + i}`)
					.setLabel(safeLabel)
					.setStyle(ButtonStyle.Secondary),
			);
		sections.push(section);
	}
	return sections;
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

			// Build Container with all components
			const container = new ContainerBuilder().setAccentColor(0x0099ff);

			// Header
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("📊 **Music Stats**"));

			// Stats
			container.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent(`**Total plays on this server:** ${totalPlays}\n**Your total plays:** ${userTotalPlays}`),
			);

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Top Listeners section
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("👂 **Top 10 Listeners (Server)**"));

			if (topListeners.length === 0) {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_No plays recorded yet!_"));
			} else {
				const listenersText = topListeners
					.map((entry, index) => {
						const plays = entry.play_count === 1 ? "play" : "plays";
						return `${index + 1}. **${entry.user_name}** — ${entry.play_count} ${plays}`;
					})
					.join("\n");
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent(listenersText));
			}

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Top Overall section
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("🏆 **Top 10 Most Played (Server)**"));

			if (topOverall.length > 0) {
				const videoSections = buildVideoSections(topOverall, 0);
				container.addSectionComponents(...videoSections);
			} else {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_No plays recorded yet!_"));
			}

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Top By User section
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("🎵 **Your Top 10 Most Played**"));

			if (topByUser.length > 0) {
				const userVideoSections = buildVideoSections(topByUser, topOverall.length);
				container.addSectionComponents(...userVideoSections);
			} else {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_You haven't played anything yet!_"));
			}

			// Collect all video URLs in order for playButtonStore
			const allVideoUrls = [...topOverall.map((e) => e.video_url), ...topByUser.map((e) => e.video_url)];

			// Send single message with Container
			const sent = await message.reply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});

			// Store all video URLs for button interactions
			if (allVideoUrls.length > 0) {
				playButtonStore.set(sent.id, allVideoUrls);
			}

			log.info("Musicstats sent (guild:", guildId, "totalPlays:", totalPlays, ")");
			return sent;
		} catch (e) {
			log.error("Failed to get music stats:", e);
			return message.reply(`Failed to get music stats: ${e.message}`);
		}
	},
};
