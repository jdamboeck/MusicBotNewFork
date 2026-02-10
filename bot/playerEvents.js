const { ActivityType } = require("discord-api-types/v10");
const { setBotActivity, setVoiceChannelStatus, isYouTubeUrl, truncate } = require("./activity");
const { tryPlaySoundboardSlot1, SOUNDBOARD_ICON_DURATION_MS } = require("./soundboard");

/**
 * Register player event handlers.
 * @param {import("discord-player").Player} player
 * @param {import("discord.js").Client} client
 */
function registerPlayerEvents(player, client) {
	player.events.on("error", (queue, error) => {
		console.error(`Error emitted from the queue: ${error.message}`);
	});

	player.events.on("playerError", (queue, error) => {
		console.error(`Audio player error: ${error.message}`);
	});

	player.events.on("playerStart", (queue, track) => {
		const channel = queue.channel;
		const guild = channel?.guild;
		console.log("[playerStart] track:", track?.title, "channel:", channel?.id ?? channel, "guild:", guild?.id ?? guild);

		// 1) Set voice channel status to music icon first (status under the bot in the VC)
		setVoiceChannelStatus(client, channel, "🎵 Finding the best audio quality");
		setBotActivity(client, { name: "🎵 Finding the best audio quality", type: ActivityType.Listening });
		console.log("[playerStart] Set activity and channel status to music icon 🎵");

		// 2) Play soundboard slot 1 before/alongside the track (fire-and-forget)
		tryPlaySoundboardSlot1(guild, channel).catch((err) => console.warn("[playerStart] tryPlaySoundboardSlot1 rejected:", err));

		// 3) After a short delay, set voice channel status and activity to the currently playing song
		const listeners = channel?.members?.filter((m) => !m.user.bot).size ?? 0;
		const channelName = channel?.name ?? "voice";
		const state = `to ${listeners} listener${listeners !== 1 ? "s" : ""} in #${channelName}`;
		const isYoutube = isYouTubeUrl(track.url);
		const trackTitle = "💥 Blasting " + truncate(track.title, 160);
		const trackActivity = {
			name: trackTitle,
			state,
			type: isYoutube ? ActivityType.Streaming : ActivityType.Listening,
			...(isYoutube && track.url && { url: track.url }),
		};
		setTimeout(() => {
			setVoiceChannelStatus(client, channel, trackTitle);
			setBotActivity(client, trackActivity);
			console.log("[playerStart] Set channel status and activity to track:", trackTitle);
		}, SOUNDBOARD_ICON_DURATION_MS);
	});

	player.events.on("emptyQueue", (queue) => {
		setBotActivity(client, null);
		// Clear voice channel status when queue is done (bot may still be in channel)
		if (queue?.channel) setVoiceChannelStatus(client, queue.channel, "");
	});
}

module.exports = {
	registerPlayerEvents,
};
