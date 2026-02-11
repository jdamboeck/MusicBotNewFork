/**
 * PO Token provider for YouTube authentication.
 */

const http = require("http");
const { createLogger } = require("../core/logger");
const config = require("./config");

const log = createLogger("po-token");

/**
 * Fetches a PO token from the bgutil provider HTTP server.
 * @param {string} contentBinding - Optional content binding
 * @returns {Promise<string|null>} The PO token or null if failed
 */
async function fetchPoToken(contentBinding = null) {
	const { poTokenUrl, poTokenRetries, poTokenRetryDelay } = config;

	return new Promise((resolve) => {
		const url = new URL("/get_pot", poTokenUrl);
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
					const contentType = res.headers["content-type"] || "";
					if (!contentType.includes("application/json") && data.startsWith("<!DOCTYPE")) {
						log.error(`Server returned HTML instead of JSON (status ${res.statusCode})`);

						if (attemptsLeft > 0) {
							log.info(`Retrying in ${poTokenRetryDelay}ms... (${attemptsLeft} attempts left)`);
							setTimeout(() => attemptFetch(attemptsLeft - 1), poTokenRetryDelay);
							return;
						}

						log.error("Server may not be ready. Make sure the provider is running.");
						resolve(null);
						return;
					}

					try {
						const json = JSON.parse(data);
						const token = json.poToken || json.po_token;
						if (token) {
							log.info("Successfully fetched token");
							if (json.expiresAt) {
								log.debug(`Token expires at: ${json.expiresAt}`);
							}
							resolve(token);
						} else if (json.error) {
							log.error("Server returned error:", json.error);
							resolve(null);
						} else {
							log.error("No token in response:", json);
							resolve(null);
						}
					} catch (err) {
						log.error("Failed to parse response:", err.message);

						if (attemptsLeft > 0) {
							log.info(`Retrying in ${poTokenRetryDelay}ms... (${attemptsLeft} attempts left)`);
							setTimeout(() => attemptFetch(attemptsLeft - 1), poTokenRetryDelay);
							return;
						}

						resolve(null);
					}
				});
			});

			req.on("error", (err) => {
				log.error("HTTP request failed:", err.message);

				if (attemptsLeft > 0) {
					log.info(`Retrying in ${poTokenRetryDelay}ms... (${attemptsLeft} attempts left)`);
					setTimeout(() => attemptFetch(attemptsLeft - 1), poTokenRetryDelay);
					return;
				}

				resolve(null);
			});

			req.write(postData);
			req.end();
		};

		attemptFetch(poTokenRetries);
	});
}

/**
 * Cache for PO tokens with expiry.
 */
class PoTokenCache {
	constructor(ttlHours = config.poTokenTtlHours) {
		this.cache = new Map();
		this.ttl = ttlHours * 60 * 60 * 1000;
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
