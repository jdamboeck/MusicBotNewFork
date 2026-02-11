/**
 * Store for musicstats play-button URLs. Keyed by message id so button clicks can resolve the video URL.
 * Entries are pruned after TTL_MS.
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes

/** @type {Map<string, { urls: string[], createdAt: number }>} */
const store = new Map();

/**
 * @param {string} messageId - Discord message id (the musicstats reply message)
 * @param {string[]} urls - Video URLs in order (overall top 10 first, then user top 10)
 */
function set(messageId, urls) {
	store.set(messageId, { urls, createdAt: Date.now() });
}

/**
 * @param {string} messageId
 * @param {number} index - Button index 0..19
 * @returns {string|null} Video URL or null
 */
function getUrl(messageId, index) {
	const entry = store.get(messageId);
	if (!entry) return null;
	if (Date.now() - entry.createdAt > TTL_MS) {
		store.delete(messageId);
		return null;
	}
	const url = entry.urls[index];
	return url ?? null;
}

function prune() {
	const now = Date.now();
	for (const [id, entry] of store.entries()) {
		if (now - entry.createdAt > TTL_MS) store.delete(id);
	}
}

module.exports = { set, getUrl, prune };
