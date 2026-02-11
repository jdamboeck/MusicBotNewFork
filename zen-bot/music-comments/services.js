/**
 * Track comments services - session management and comment scheduling.
 */

const { ThreadAutoArchiveDuration } = require("discord.js");
const { createLogger } = require("../core/logger");

const log = createLogger("music-comments");

/**
 * Active tracking sessions per guild.
 * Map<guildId, { messageId, trackUrl, startTime, channelId, message, threadChannel?, scheduledTimeouts }>
 */
const activeSessions = new Map();

/** Thread name for comments/reactions playback (Discord limit 100 chars). */
const PLAYBACK_THREAD_NAME = "Comments";

/**
 * Maximum comment text length before truncation (not applied to URLs).
 */
const MAX_COMMENT_LENGTH = 200;

/**
 * Command prefix - replies starting with this are not recorded as comments.
 */
const COMMAND_PREFIX = "#";

/**
 * Truncate text to a maximum length, preserving URLs.
 */
function truncateText(text, maxLength = MAX_COMMENT_LENGTH) {
	if (text.startsWith("http://") || text.startsWith("https://")) {
		return text;
	}

	if (text.includes("\n")) {
		const lines = text.split("\n");
		const truncatedLines = lines.map((line) => {
			if (line.startsWith("http://") || line.startsWith("https://")) {
				return line;
			}
			if (line.length <= maxLength) return line;
			return line.slice(0, maxLength - 3) + "...";
		});
		return truncatedLines.join("\n");
	}

	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + "...";
}

/**
 * Start tracking a session for reply monitoring.
 * @param {string} [trackTitle] - Track title for the reactions headline
 */
function startTrackingSession(guildId, message, trackUrl, trackTitle = "") {
	stopTrackingSession(guildId);

	const session = {
		messageId: message.id,
		trackUrl,
		trackTitle: trackTitle || "",
		startTime: Date.now(),
		channelId: message.channel.id,
		message,
		scheduledTimeouts: [],
	};

	activeSessions.set(guildId, session);
	log.info(`Started tracking session for guild ${guildId}, message ${message.id}`);
}

/**
 * Stop tracking a session and cancel all scheduled comment playbacks.
 */
function stopTrackingSession(guildId) {
	const session = activeSessions.get(guildId);
	if (session) {
		for (const timeoutId of session.scheduledTimeouts) {
			clearTimeout(timeoutId);
		}
		log.info(`Stopped tracking session for guild ${guildId}, cancelled ${session.scheduledTimeouts.length} scheduled comments`);
	}

	activeSessions.delete(guildId);
}

/**
 * Get the active session for a guild.
 */
function getActiveSession(guildId) {
	return activeSessions.get(guildId);
}

/**
 * Create a thread from the enqueued message for playback when there are comments or reactions.
 * Stores the thread in session.threadChannel; playback will send to the thread.
 * @param {string} guildId
 * @param {import("discord.js").Message} message - Enqueued message
 * @param {string} trackUrl
 * @param {object} ctx
 * @returns {Promise<import("discord.js").ThreadChannel|null>} The thread channel or null
 */
async function ensurePlaybackThread(guildId, message, trackUrl, ctx) {
	const session = activeSessions.get(guildId);
	if (!session) return null;

	const comments = ctx.db.music.getTrackComments(trackUrl, guildId);
	const reactions = ctx.db.music.getTrackReactions(trackUrl, guildId);
	if (comments.length === 0 && reactions.length === 0) return null;

	try {
		// When a thread already exists on this message (e.g. from a previous play), use it (thread id === message id)
		if (message.hasThread) {
			const existing = message.channel.threads.cache.get(message.id) ?? await message.channel.threads.fetch(message.id).catch(() => null);
			if (existing) {
				session.threadChannel = existing;
				log.debug("Using existing thread for playback:", existing.id);
				return existing;
			}
		}
		const thread = await message.startThread({
			name: PLAYBACK_THREAD_NAME,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
			reason: "Comments and reactions playback",
		});
		session.threadChannel = thread;
		log.info("Created playback thread for guild " + guildId + ": " + thread.name);
		return thread;
	} catch (err) {
		log.warn("Could not create playback thread, using channel:", err.message);
		session.threadChannel = null;
		return null;
	}
}

const REACTION_BIG_REPEAT = 3;

/**
 * Schedule comment playback for all stored comments on a track.
 */
function scheduleCommentPlayback(guildId, message, trackUrl, ctx) {
	const session = activeSessions.get(guildId);
	if (!session) {
		log.warn(`No active session for guild ${guildId}, cannot schedule playback`);
		return;
	}

	const comments = ctx.db.music.getTrackComments(trackUrl, guildId);
	if (comments.length === 0) {
		log.debug(`No comments to play back for track: ${trackUrl}`);
		return;
	}

	log.info(`Scheduling ${comments.length} comments for playback`);

	for (const comment of comments) {
		const delay = comment.timestamp_ms;

		const timeoutId = setTimeout(async () => {
			try {
				const commentText = comment.comment_text;

				const lines = commentText.split("\n");
				const textParts = [];
				const urlParts = [];

				for (const line of lines) {
					if (line.startsWith("http://") || line.startsWith("https://")) {
						urlParts.push(line);
					} else if (line.trim()) {
						textParts.push(line);
					}
				}

				let commentMessage = `💬 **${comment.user_name}:**`;
				if (textParts.length > 0) {
					commentMessage += ` ${truncateText(textParts.join(" "))}`;
				}

				if (urlParts.length > 0) {
					commentMessage += "\n" + urlParts.join("\n");
				}

				await message.channel.send(commentMessage);
				log.debug(`Displayed comment at ${delay}ms: ${comment.user_name}`);
			} catch (err) {
				log.warn("Failed to send comment:", err.message);
			}
		}, delay);

		session.scheduledTimeouts.push(timeoutId);
	}
}

/**
 * Schedule reaction playback for all stored reactions on a track.
 * Sends name then the reaction emoji prominently (on its own line, repeated for emphasis).
 */
function scheduleReactionPlayback(guildId, message, trackUrl, ctx) {
	const session = activeSessions.get(guildId);
	if (!session) {
		log.warn(`No active session for guild ${guildId}, cannot schedule reaction playback`);
		return;
	}

	const reactions = ctx.db.music.getTrackReactions(trackUrl, guildId);
	if (reactions.length === 0) {
		log.debug(`No reactions to play back for track: ${trackUrl}`);
		return;
	}

	log.info(`Scheduling ${reactions.length} reactions for playback`);

	for (const reaction of reactions) {
		const delay = reaction.timestamp_ms;

		const timeoutId = setTimeout(async () => {
			try {
				const emoji = reaction.reaction_emoji;
				const bigEmoji = (emoji + " ").repeat(REACTION_BIG_REPEAT).trim();
				const reactionMessage = `**${reaction.user_name}:**\n\n${bigEmoji}`;
				await message.channel.send(reactionMessage);
				log.debug(`Displayed reaction at ${delay}ms: ${reaction.user_name} ${emoji}`);
			} catch (err) {
				log.warn("Failed to send reaction playback:", err.message);
			}
		}, delay);

		session.scheduledTimeouts.push(timeoutId);
	}
}

/**
 * Schedule both comments and reactions in a single timeline.
 * Each reaction line: "EMOJI EMOJI  USERNAME  EMOJI EMOJI" (username in ALL CAPS), at its timestamp.
 * A blank line (vertical space) is sent after every played-back message for separation.
 * Recorded reactions are also added as real reactions on the enqueued message.
 */
function scheduleCommentAndReactionPlayback(guildId, message, trackUrl, ctx) {
	const session = activeSessions.get(guildId);
	if (!session) return;

	const comments = ctx.db.music.getTrackComments(trackUrl, guildId);
	const reactions = ctx.db.music.getTrackReactions(trackUrl, guildId);

	const items = [
		...comments.map((c) => ({ type: "comment", timestamp_ms: c.timestamp_ms, data: c })),
		...reactions.map((r) => ({ type: "reaction", timestamp_ms: r.timestamp_ms, data: r })),
	].sort((a, b) => a.timestamp_ms - b.timestamp_ms || (a.type === "reaction" ? 1 : -1));

	if (items.length === 0) {
		log.debug(`No comments or reactions to play back for track: ${trackUrl}`);
		return;
	}

	const playbackTarget = session.threadChannel || message.channel;
	const verticalSpace = "\u200B"; // zero-width space: blank message for vertical gap

	// Headline: bigger/bolder text with vertical spacers above and below (Discord: bold + caps)
	const REACTIONS_ICON = "⚡";
	const trackTitleDisplay = (session.trackTitle || "Track").trim().replace(/\s*:\s*$/, "") || "Track";
	const headline = `**${REACTIONS_ICON} REACTIONS TO ${trackTitleDisplay.toUpperCase()}:**`;

	(async () => {
		try {
			await playbackTarget.send(verticalSpace);
			await playbackTarget.send(headline);
			await playbackTarget.send(verticalSpace);
		} catch (err) {
			log.warn("Failed to send reactions headline:", err.message);
		}
	})();

	log.info(`Scheduling ${comments.length} comments and ${reactions.length} reactions → ${session.threadChannel ? "thread" : "channel"}`);

	for (const item of items) {
		const delay = item.timestamp_ms;

		const timeoutId = setTimeout(async () => {
			try {
				if (item.type === "comment") {
					const comment = item.data;
					const commentText = comment.comment_text;
					const lines = commentText.split("\n");
					const textParts = [];
					const urlParts = [];
					for (const line of lines) {
						if (line.startsWith("http://") || line.startsWith("https://")) urlParts.push(line);
						else if (line.trim()) textParts.push(line);
					}
					let commentMessage = `💬 **${comment.user_name}:**`;
					if (textParts.length > 0) commentMessage += ` ${truncateText(textParts.join(" "))}`;
					if (urlParts.length > 0) commentMessage += "\n" + urlParts.join("\n");
					await playbackTarget.send(commentMessage);
					await playbackTarget.send(verticalSpace);
					log.debug(`Displayed comment at ${delay}ms: ${comment.user_name}`);
				} else {
					// Reaction line: EMOJI EMOJI  USERNAME  EMOJI EMOJI (username in ALL CAPS)
					const reaction = item.data;
					const emoji = reaction.reaction_emoji;
					const usernameCaps = (reaction.user_name || "").toUpperCase();
					const line = `${emoji} ${emoji}  ${usernameCaps}  ${emoji} ${emoji}`;
					await playbackTarget.send(line);
					await playbackTarget.send(verticalSpace);
					await message.react(emoji).catch((e) => log.debug("Could not add reaction to enqueued message:", e.message));
					log.debug(`Displayed reaction at ${delay}ms: ${reaction.user_name} ${emoji}`);
				}
			} catch (err) {
				log.warn("Failed to send playback:", err.message);
			}
		}, delay);

		session.scheduledTimeouts.push(timeoutId);
	}
}

/**
 * Handle a reaction added to a message (e.g. the enqueued message).
 * @param {import("discord.js").MessageReaction} reaction
 * @param {import("discord.js").User} user
 * @param {object} ctx
 * @returns {boolean} True if the reaction was handled as a tracked enqueued message
 */
async function handleReactionAdd(reaction, user, ctx) {
	if (user.bot) return false;

	const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
	const messageId = msg.id;
	const guildId = msg.guildId;
	if (!guildId) return false;

	const session = activeSessions.get(guildId);
	if (!session || session.messageId !== messageId) return false;

	const timestampMs = Date.now() - session.startTime;
	const resolvedUser = user.partial ? await user.fetch() : user;
	const userName = resolvedUser.username || resolvedUser.tag;
	const reactionEmoji = reaction.emoji.toString();

	try {
		ctx.db.music.saveTrackReaction({
			videoUrl: session.trackUrl,
			guildId,
			userId: resolvedUser.id,
			userName,
			reactionEmoji,
			timestampMs,
		});

		const minutes = Math.floor(timestampMs / 60000);
		const seconds = Math.floor((timestampMs % 60000) / 1000);
		const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
		log.info(`Recorded reaction from ${userName} at ${timeStr}: ${reactionEmoji}`);
	} catch (err) {
		log.error("Failed to save reaction:", err);
	}

	return true;
}

/**
 * Handle a potential reply to a tracked message.
 * @returns {boolean} True if the message was handled as a reply to a tracked session
 */
function handlePotentialReply(message, ctx) {
	if (message.author.bot) return false;
	if (message.content.startsWith(COMMAND_PREFIX)) return false;
	if (!message.reference?.messageId) return false;

	const guildId = message.guild?.id;
	if (!guildId) return false;

	const session = activeSessions.get(guildId);
	if (!session) return false;

	if (message.reference.messageId !== session.messageId) return false;

	const timestampMs = Date.now() - session.startTime;

	let commentText = message.content.trim();

	if (message.attachments.size > 0) {
		const attachmentUrls = message.attachments.map((a) => a.url);
		if (commentText) {
			commentText += "\n" + attachmentUrls.join("\n");
		} else {
			commentText = attachmentUrls.join("\n");
		}
	}

	if (message.stickers.size > 0) {
		const stickerUrls = message.stickers.map((s) => s.url);
		if (commentText) {
			commentText += "\n" + stickerUrls.join("\n");
		} else {
			commentText = stickerUrls.join("\n");
		}
	}

	if (!commentText) {
		log.debug(`Ignored empty reply from ${message.author.username}`);
		return true;
	}

	try {
		ctx.db.music.saveTrackComment({
			videoUrl: session.trackUrl,
			guildId,
			userId: message.author.id,
			userName: message.author.username || message.author.tag,
			commentText,
			timestampMs,
		});

		const minutes = Math.floor(timestampMs / 60000);
		const seconds = Math.floor((timestampMs % 60000) / 1000);
		const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

		log.info(`Recorded comment from ${message.author.username} at ${timeStr}: "${commentText.slice(0, 50)}..."`);

		message.react("💬").catch(() => {});
	} catch (err) {
		log.error("Failed to save comment:", err);
	}

	return true;
}

module.exports = {
	activeSessions,
	startTrackingSession,
	stopTrackingSession,
	getActiveSession,
	ensurePlaybackThread,
	scheduleCommentPlayback,
	scheduleReactionPlayback,
	scheduleCommentAndReactionPlayback,
	handlePotentialReply,
	handleReactionAdd,
};
