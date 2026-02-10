const { ActivityType } = require("discord-api-types/v10");
const { setBotActivity, setVoiceChannelStatus, isYouTubeUrl, truncate } = require("./activity");
const { tryPlaySoundboardSlot1, SOUNDBOARD_ICON_DURATION_MS } = require("./soundboard");
const { recordPlay } = require("./database");
const { startTrackingSession, stopTrackingSession, scheduleCommentPlayback } = require("./trackComments");

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

		// Record the play in the database
		const requestedBy = queue.metadata?.author;
		if (requestedBy && guild && track) {
			try {
				recordPlay({
					videoUrl: track.url,
					videoTitle: track.title,
					userId: requestedBy.id,
					userName: requestedBy.username || requestedBy.tag,
					guildId: guild.id,
				});
			} catch (err) {
				console.error("[playerStart] Failed to record play:", err);
			}
		}

		// Start track comment tracking if we have the enqueued message
		const enqueuedMessage = queue.metadata?.enqueuedMessage;
		if (enqueuedMessage && guild && track) {
			try {
				// Start tracking session for this playback
				startTrackingSession(guild.id, enqueuedMessage, track.url);

				// Schedule playback of any existing comments for this track
				scheduleCommentPlayback(guild.id, enqueuedMessage, track.url);
			} catch (err) {
				console.error("[playerStart] Failed to setup track comments:", err);
			}
		}

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

		// Stop track comment tracking
		const guildId = queue?.channel?.guild?.id;
		if (guildId) {
			stopTrackingSession(guildId);
		}
	});
}

module.exports = {
	registerPlayerEvents,
};
