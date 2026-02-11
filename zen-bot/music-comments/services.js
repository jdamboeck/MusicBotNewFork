/**
 * Track comments services - session management and comment scheduling.
 */

const { createLogger } = require("../core/logger");

const log = createLogger("music-comments");

/**
 * Active tracking sessions per guild.
 * Map<guildId, { messageId, trackUrl, startTime, channelId, message, scheduledTimeouts }>
 */
const activeSessions = new Map();

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
 */
function startTrackingSession(guildId, message, trackUrl) {
	stopTrackingSession(guildId);

	const session = {
		messageId: message.id,
		trackUrl,
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
 * Schedule both comments and reactions in a single timeline, so they play back in sync order by timestamp.
 * Comments and reactions at the same timestamp are ordered: comments first, then reactions.
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

	log.info(`Scheduling ${comments.length} comments and ${reactions.length} reactions for playback (${items.length} total)`);

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
					await message.channel.send(commentMessage);
					log.debug(`Displayed comment at ${delay}ms: ${comment.user_name}`);
				} else {
					const reaction = item.data;
					const emoji = reaction.reaction_emoji;
					const bigEmoji = (emoji + " ").repeat(REACTION_BIG_REPEAT).trim();
					await message.channel.send(`**${reaction.user_name}:**\n\n${bigEmoji}`);
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
	scheduleCommentPlayback,
	scheduleReactionPlayback,
	scheduleCommentAndReactionPlayback,
	handlePotentialReply,
	handleReactionAdd,
};
