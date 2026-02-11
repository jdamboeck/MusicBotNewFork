/**
 * Bot activity and voice channel status management.
 */

const { ActivityType } = require("discord-api-types/v10");
const { createLogger } = require("../logger");

const log = createLogger("activity");
const MAX_ACTIVITY_LEN = 128;

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max = MAX_ACTIVITY_LEN) {
	return str && str.length > max ? str.slice(0, max - 3) + "..." : str;
}

/**
 * Set the bot's activity/presence.
 * @param {import("discord.js").Client} client
 * @param {string|object|null} activityOrName - String for simple activity, or { name, state?, type?, url? }
 */
function setBotActivity(client, activityOrName) {
	if (!client.user) return;
	if (!activityOrName) {
		log.debug("Activity cleared");
		client.user.setActivity(null);
		return;
	}
	if (typeof activityOrName === "string") {
		log.debug("Activity set:", truncate(activityOrName));
		client.user.setActivity(truncate(activityOrName));
		return;
	}
	// Full activity: { name, state?, type?, url? }
	const name = truncate(activityOrName.name);
	const state = activityOrName.state != null ? truncate(String(activityOrName.state)) : undefined;
	const opts = { type: activityOrName.type ?? ActivityType.Playing, state };
	if (activityOrName.url) opts.url = activityOrName.url;
	log.debug("Activity set:", name, state ? `(${state})` : "");
	client.user.setActivity(name, opts);
}

/**
 * Set the voice channel status (the status text shown under the bot in the voice channel).
 * Uses Discord API PUT /channels/:id/voice-status. Bot must be in the channel.
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").VoiceChannel|string} voiceChannel
 * @param {string|null} status
 */
async function setVoiceChannelStatus(client, voiceChannel, status) {
	const channelId = voiceChannel?.id ?? voiceChannel;
	if (!channelId || !client.rest) return;
	const text = status == null ? "" : String(status).slice(0, MAX_ACTIVITY_LEN);
	try {
		await client.rest.put(`/channels/${channelId}/voice-status`, { body: { status: text } });
		log.debug("Set voice status to:", text || "(empty)");
	} catch (e) {
		log.warn("Failed to set voice status:", e.message || e);
	}
}

/**
 * Check if a URL is a YouTube URL.
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
	if (!url || typeof url !== "string") return false;
	try {
		const u = new URL(url);
		return u.hostname === "youtube.com" || u.hostname === "www.youtube.com" || u.hostname === "youtu.be";
	} catch {
		return false;
	}
}

module.exports = {
	MAX_ACTIVITY_LEN,
	truncate,
	setBotActivity,
	setVoiceChannelStatus,
	isYouTubeUrl,
};
