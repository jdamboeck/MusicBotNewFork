const { saveTrackComment, getTrackComments } = require("./database");

/**
 * Active tracking sessions per guild.
 * Map<guildId, { messageId, trackUrl, startTime, channelId, scheduledTimeouts }>
 */
const activeSessions = new Map();

/**
 * Maximum comment text length before truncation (not applied to URLs).
 */
const MAX_COMMENT_LENGTH = 200;

/**
 * Truncate text to a maximum length, preserving URLs.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength = MAX_COMMENT_LENGTH) {
	// Don't truncate if it's just a URL (attachment)
	if (text.startsWith("http://") || text.startsWith("https://")) {
		return text;
	}
	
	// If text contains newlines (likely has URLs), only truncate non-URL parts
	if (text.includes("\n")) {
		const lines = text.split("\n");
		const truncatedLines = lines.map(line => {
			if (line.startsWith("http://") || line.startsWith("https://")) {
				return line; // Don't truncate URLs
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
 * @param {string} guildId - Discord guild ID
 * @param {import("discord.js").Message} message - The "enqueued" message to track replies to
 * @param {string} trackUrl - URL of the track being played
 */
function startTrackingSession(guildId, message, trackUrl) {
	// Stop any existing session first
	stopTrackingSession(guildId);

	const session = {
		messageId: message.id,
		trackUrl,
		startTime: Date.now(),
		channelId: message.channel.id,
		message, // Keep reference for sending comments
		scheduledTimeouts: [],
	};

	activeSessions.set(guildId, session);

	console.log(`[TrackComments] Started tracking session for guild ${guildId}, message ${message.id}`);
}

/**
 * Stop tracking a session and cancel all scheduled comment playbacks.
 * @param {string} guildId - Discord guild ID
 */
function stopTrackingSession(guildId) {
	const session = activeSessions.get(guildId);
	if (session) {
		// Cancel all scheduled timeouts
		for (const timeoutId of session.scheduledTimeouts) {
			clearTimeout(timeoutId);
		}
		console.log(`[TrackComments] Stopped tracking session for guild ${guildId}, cancelled ${session.scheduledTimeouts.length} scheduled comments`);
	}

	activeSessions.delete(guildId);
}

/**
 * Get the active session for a guild.
 * @param {string} guildId - Discord guild ID
 * @returns {Object|undefined}
 */
function getActiveSession(guildId) {
	return activeSessions.get(guildId);
}

/**
 * Schedule comment playback for all stored comments on a track.
 * @param {string} guildId - Discord guild ID
 * @param {import("discord.js").Message} message - The message to edit
 * @param {string} trackUrl - URL of the track
 * @param {string} trackTitle - Title of the track for the base message
 */
function scheduleCommentPlayback(guildId, message, trackUrl) {
	const session = activeSessions.get(guildId);
	if (!session) {
		console.warn(`[TrackComments] No active session for guild ${guildId}, cannot schedule playback`);
		return;
	}

	const comments = getTrackComments(trackUrl, guildId);
	if (comments.length === 0) {
		console.log(`[TrackComments] No comments to play back for track: ${trackUrl}`);
		return;
	}

	console.log(`[TrackComments] Scheduling ${comments.length} comments for playback`);

	for (const comment of comments) {
		const delay = comment.timestamp_ms;

		// Schedule the comment display at the exact timestamp
		const timeoutId = setTimeout(async () => {
			try {
				const commentText = comment.comment_text;
				
				// Check if comment contains URLs (attachments/GIFs)
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
				
				// Build the comment message
				let commentMessage = `💬 **${comment.user_name}:**`;
				if (textParts.length > 0) {
					commentMessage += ` ${truncateText(textParts.join(" "))}`;
				}
				
				// If there are URLs (GIFs/images), append them on new lines so Discord embeds them
				if (urlParts.length > 0) {
					commentMessage += "\n" + urlParts.join("\n");
				}
				
				// Send as a new message in the channel (so GIFs render properly)
				await message.channel.send(commentMessage);
				console.log(`[TrackComments] Displayed comment at ${delay}ms: ${comment.user_name}`);
			} catch (err) {
				console.warn(`[TrackComments] Failed to send comment:`, err.message);
			}
		}, delay);

		session.scheduledTimeouts.push(timeoutId);
	}
}

/**
 * Command prefix - replies starting with this are not recorded as comments.
 */
const COMMAND_PREFIX = "#";

/**
 * Handle a potential reply to a tracked message.
 * Call this from the messageCreate event handler.
 * @param {import("discord.js").Message} message - The incoming message
 * @returns {boolean} True if the message was handled as a reply to a tracked session
 */
function handlePotentialReply(message) {
	// Ignore bot messages
	if (message.author.bot) return false;

	// Ignore commands (messages starting with prefix)
	if (message.content.startsWith(COMMAND_PREFIX)) return false;

	// Check if this is a reply
	if (!message.reference?.messageId) return false;

	const guildId = message.guild?.id;
	if (!guildId) return false;

	const session = activeSessions.get(guildId);
	if (!session) return false;

	// Check if the reply is to our tracked message
	if (message.reference.messageId !== session.messageId) return false;

	// Calculate the timestamp relative to track start
	const timestampMs = Date.now() - session.startTime;

	// Build comment text from content and/or attachments
	let commentText = message.content.trim();
	
	// Check for attachments (images, GIFs, etc.)
	if (message.attachments.size > 0) {
		const attachmentUrls = message.attachments.map(a => a.url);
		// Append attachment URLs to the comment (they'll render as embeds in Discord)
		if (commentText) {
			commentText += "\n" + attachmentUrls.join("\n");
		} else {
			commentText = attachmentUrls.join("\n");
		}
	}
	
	// Check for stickers
	if (message.stickers.size > 0) {
		const stickerUrls = message.stickers.map(s => s.url);
		if (commentText) {
			commentText += "\n" + stickerUrls.join("\n");
		} else {
			commentText = stickerUrls.join("\n");
		}
	}

	if (!commentText) {
		console.log(`[TrackComments] Ignored empty reply from ${message.author.username}`);
		return true;
	}

	// Save the comment to the database
	try {
		saveTrackComment({
			videoUrl: session.trackUrl,
			guildId,
			userId: message.author.id,
			userName: message.author.username || message.author.tag,
			commentText,
			timestampMs,
		});

		// Format timestamp as mm:ss
		const minutes = Math.floor(timestampMs / 60000);
		const seconds = Math.floor((timestampMs % 60000) / 1000);
		const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

		console.log(`[TrackComments] Recorded comment from ${message.author.username} at ${timeStr}: "${commentText.slice(0, 50)}..."`);

		// React to confirm the comment was saved
		message.react("💬").catch(() => {});
	} catch (err) {
		console.error(`[TrackComments] Failed to save comment:`, err);
	}

	return true;
}

module.exports = {
	startTrackingSession,
	stopTrackingSession,
	getActiveSession,
	scheduleCommentPlayback,
	handlePotentialReply,
};
