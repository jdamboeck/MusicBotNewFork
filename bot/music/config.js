/**
 * Music feature configuration - defaults with env overrides.
 */

module.exports = {
	volume: parseInt(process.env.MUSIC_VOLUME) || 50,
	leaveOnEmptyCooldown: parseInt(process.env.MUSIC_LEAVE_TIMEOUT) || 60000,
	leaveOnEndCooldown: parseInt(process.env.MUSIC_LEAVE_TIMEOUT) || 60000,
	poTokenUrl: process.env.PO_TOKEN_URL || "http://127.0.0.1:4416",
	poTokenTtlHours: parseInt(process.env.PO_TOKEN_TTL_HOURS) || 6,
	poTokenRetries: parseInt(process.env.PO_TOKEN_RETRIES) || 3,
	poTokenRetryDelay: parseInt(process.env.PO_TOKEN_RETRY_DELAY) || 2000,
};
