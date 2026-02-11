/**
 * Player start event - updates activity and plays soundboard.
 * Note: Recording plays and track comments are handled by their respective features.
 */

const { ActivityType } = require("discord-api-types/v10");
const { createLogger } = require("../../core/logger");

const log = createLogger("playerStart");

module.exports = {
	event: "playerStart",
	target: "player",

	async handle(queue, track, ctx) {
		const channel = queue.channel;
		const guild = channel?.guild;
		log.info("Track started:", track?.title, "| channel:", channel?.id, "| guild:", guild?.id);
		log.debug("playerStart: setting initial activity and soundboard");

		const { activity, soundboard } = ctx.services;

		// 1) Set voice channel status to music icon first
		activity.setVoiceChannelStatus(ctx.client, channel, "🎵 Finding the best audio quality");
		activity.setBotActivity(ctx.client, { name: "🎵 Finding the best audio quality", type: ActivityType.Listening });
		log.debug("Set activity and channel status to music icon 🎵");

		// 2) Play soundboard slot 1 before/alongside the track
		soundboard.tryPlaySoundboardSlot1(guild, channel).catch((err) => log.warn("Soundboard failed:", err));

		// 3) After a short delay, set voice channel status and activity to the currently playing song
		const listeners = channel?.members?.filter((m) => !m.user.bot).size ?? 0;
		const channelName = channel?.name ?? "voice";
		const state = `to ${listeners} listener${listeners !== 1 ? "s" : ""} in #${channelName}`;
		const isYoutube = activity.isYouTubeUrl(track.url);
		const trackTitle = "💥 Blasting " + activity.truncate(track.title, 160);
		const trackActivity = {
			name: trackTitle,
			state,
			type: isYoutube ? ActivityType.Streaming : ActivityType.Listening,
			...(isYoutube && track.url && { url: track.url }),
		};

		setTimeout(() => {
			activity.setVoiceChannelStatus(ctx.client, channel, trackTitle);
			activity.setBotActivity(ctx.client, trackActivity);
			log.debug("Set channel status and activity to track:", trackTitle);
		}, soundboard.SOUNDBOARD_ICON_DURATION_MS);
	},
};
