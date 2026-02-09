const http = require("http");

/**
 * Fetches a PO token from the bgutil provider HTTP server
 * @param {string} baseUrl - The base URL of the provider server (default: http://127.0.0.1:4416)
 * @param {string} contentBinding - Optional content binding (replaces visitor_data)
 * @param {number} retries - Number of retries if server is not ready (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 2000)
 * @returns {Promise<string|null>} The PO token or null if failed
 */
async function fetchPoToken(baseUrl = "http://127.0.0.1:4416", contentBinding = null, retries = 3, retryDelay = 2000) {
	return new Promise((resolve) => {
		const url = new URL("/get_pot", baseUrl);

		// Prepare POST body
		const postData = JSON.stringify({
			content_binding: contentBinding || undefined,
		});

		const options = {
			hostname: url.hostname,
			port: url.port || 4416,
			path: url.pathname,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData),
			},
		};

		const attemptFetch = (attemptsLeft) => {
			const req = http.request(options, (res) => {
				let data = "";

				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					// Check if response is not JSON (likely HTML error page)
					const contentType = res.headers["content-type"] || "";
					if (!contentType.includes("application/json") && data.startsWith("<!DOCTYPE")) {
						console.error(`[PO Token] Server returned HTML instead of JSON (status ${res.statusCode})`);
						console.error(`[PO Token] Full response:\n${data}`);

						if (attemptsLeft > 0) {
							console.log(`[PO Token] Retrying in ${retryDelay}ms... (${attemptsLeft} attempts left)`);
							setTimeout(() => attemptFetch(attemptsLeft - 1), retryDelay);
							return;
						}

						console.error("[PO Token] Server may not be ready. Make sure the provider is running.");
						resolve(null);
						return;
					}

					try {
						const json = JSON.parse(data);
						const token = json.poToken || json.po_token;
						if (token) {
							console.log("[PO Token] Successfully fetched token");
							if (json.expiresAt) {
								console.log(`[PO Token] Token expires at: ${json.expiresAt}`);
							}
							resolve(token);
						} else if (json.error) {
							console.error("[PO Token] Server returned error:", json.error);
							resolve(null);
						} else {
							console.error("[PO Token] No token in response:", json);
							resolve(null);
						}
					} catch (err) {
						console.error("[PO Token] Failed to parse response:", err.message);
						console.error(`[PO Token] Response was: ${data.substring(0, 200)}`);

						if (attemptsLeft > 0) {
							console.log(`[PO Token] Retrying in ${retryDelay}ms... (${attemptsLeft} attempts left)`);
							setTimeout(() => attemptFetch(attemptsLeft - 1), retryDelay);
							return;
						}

						resolve(null);
					}
				});
			});

			req.on("error", (err) => {
				console.error("[PO Token] HTTP request failed:", err.message);

				if (attemptsLeft > 0) {
					console.log(`[PO Token] Retrying in ${retryDelay}ms... (${attemptsLeft} attempts left)`);
					setTimeout(() => attemptFetch(attemptsLeft - 1), retryDelay);
					return;
				}

				resolve(null);
			});

			// Write the POST data
			req.write(postData);
			req.end();
		};

		attemptFetch(retries);
	});
}

/**
 * Cache for PO tokens with expiry
 */
class PoTokenCache {
	constructor(ttlHours = 6) {
		this.cache = new Map();
		this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
	}

	set(key, value) {
		this.cache.set(key, {
			value,
			expiry: Date.now() + this.ttl,
		});
	}

	get(key) {
		const cached = this.cache.get(key);
		if (!cached) return null;

		if (Date.now() > cached.expiry) {
			this.cache.delete(key);
			return null;
		}

		return cached.value;
	}

	clear() {
		this.cache.clear();
	}
}

module.exports = { fetchPoToken, PoTokenCache };
