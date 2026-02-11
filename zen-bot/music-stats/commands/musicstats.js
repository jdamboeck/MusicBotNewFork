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
	ThumbnailBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { createLogger } = require("../../core/logger");
const playButtonStore = require("../playButtonStore");

const log = createLogger("musicstats");

const PLAY_ICON = "▶️ ";
const STOP_ICON = "⏹️ ";

/** Discord button label max length. */
const BUTTON_LABEL_MAX = 65;

/** Title length in button (with leading space + "▶️ N. " prefix we stay under 80). */
const BUTTON_TITLE_LENGTH = 50;

/**
 * Truncate a title to a maximum length.
 */
function truncateTitle(title, maxLength) {
	if (title.length <= maxLength) return title;
	return title.slice(0, maxLength - 3) + "...";
}

/**
 * Extract YouTube video ID from URL.
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
function extractYouTubeVideoId(url) {
	if (!url) return null;
	try {
		const urlObj = new URL(url);
		if (urlObj.hostname === "youtu.be") {
			return urlObj.pathname.slice(1);
		}
		if (urlObj.hostname === "youtube.com" || urlObj.hostname === "www.youtube.com") {
			return urlObj.searchParams.get("v");
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Get YouTube thumbnail URL from video URL.
 * @param {string} videoUrl - YouTube video URL
 * @returns {string|null} Thumbnail URL or null
 */
function getYouTubeThumbnailUrl(videoUrl) {
	const videoId = extractYouTubeVideoId(videoUrl);
	if (!videoId) return null;
	return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
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
		// Ensure title exists and is valid
		const safeTitle = (entry.video_title || "Unknown Title").trim() || "Unknown Title";
		const title = truncateTitle(safeTitle, BUTTON_TITLE_LENGTH);
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

			// Get stats - limit to stay under Discord's 40 component limit
			// Component count (nested components count toward limit):
			// - Base: Container(1) + TextDisplays(7) + Separators(5) = 13 components
			// - Each video Section: Section(1) + TextDisplay(1) + Button(1) = 3 components
			// - Last played Section: Section(1) + TextDisplay(1) + Thumbnail(1) = 3 components
			// - Stop Section: Section(1) + TextDisplay(1) + Button(1) = 3 components
			// With 3 top overall + 3 top by user + 1 last played + 1 stop = 8 sections (24 components)
			// Total: 13 + 24 = 37 components (under 40 limit)
			const topOverall = music.getTopVideosOverall(guildId, 3);
			const topByUser = music.getTopVideosByUser(guildId, userId, 3);
			const topListeners = music.getTopListeners(guildId, 10);
			const totalPlays = music.getTotalPlays(guildId);
			const userTotalPlays = music.getUserTotalPlays(guildId, userId);
			const lastPlayed = music.getLastPlayedVideo(guildId);

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
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("🏆 **Top 3 Most Played (Server)**"));

			if (topOverall.length > 0) {
				const videoSections = buildVideoSections(topOverall, 0);
				container.addSectionComponents(...videoSections);
			} else {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_No plays recorded yet!_"));
			}

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Top By User section
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("🎵 **Your Top 3 Most Played**"));

			if (topByUser.length > 0) {
				const userVideoSections = buildVideoSections(topByUser, topOverall.length);
				container.addSectionComponents(...userVideoSections);
			} else {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_You haven't played anything yet!_"));
			}

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Last Played Video section
			container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("**Last played Video**"));

			if (lastPlayed && lastPlayed.video_title) {
				const thumbnailUrl = getYouTubeThumbnailUrl(lastPlayed.video_url);
				// Truncate title to ensure it fits within Discord limits
				const title = truncateTitle(lastPlayed.video_title || "Unknown Title", 200);
				// Ensure title is not empty
				const displayTitle = title.trim() || "Unknown Title";
				const lastPlayedSection = new SectionBuilder()
					.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`**${displayTitle}**`));

				if (thumbnailUrl) {
					lastPlayedSection.setThumbnailAccessory((thumbnail) =>
						thumbnail.setDescription(displayTitle).setURL(thumbnailUrl),
					);
				}

				container.addSectionComponents(lastPlayedSection);
			} else {
				container.addTextDisplayComponents((textDisplay) => textDisplay.setContent("_No plays recorded yet!_"));
			}

			// Separator
			container.addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small));

			// Stop button section - Section requires at least one TextDisplay with valid content
			const stopSection = new SectionBuilder()
				.addTextDisplayComponents((textDisplay) => textDisplay.setContent("Control playback"))
				.setButtonAccessory((button) =>
					button
						.setCustomId("musicstats_stop")
						.setLabel(`${STOP_ICON} Stop playback`)
						.setStyle(ButtonStyle.Danger),
				);
			container.addSectionComponents(stopSection);

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
