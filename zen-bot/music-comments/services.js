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
	handlePotentialReply,
};
