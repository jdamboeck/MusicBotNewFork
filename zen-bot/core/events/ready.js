/**
 * Ready event - logs when Discord client is connected.
 */

const { createLogger } = require("../logger");

const log = createLogger("core");

module.exports = {
	event: "ready",
	target: "client",

	async handle(client, ctx) {
		log.info("Discord client ready — logged in as", client.user?.tag);
		log.debug("Guilds:", client.guilds.cache.size, "| Cached users:", client.users.cache.size);
	},
};
