/**
 * Empty queue event - clears activity.
 * Note: Track comment session cleanup is handled by music-comments feature.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("emptyQueue");

module.exports = {
	event: "emptyQueue",
	target: "player",

	async handle(queue, ctx) {
		const guildId = queue?.guild?.id ?? "unknown";
		log.info("Queue empty, clearing activity (guild:", guildId, ")");
		log.debug("Queue empty, clearing activity");

		ctx.services.activity.setBotActivity(ctx.client, null);

		if (queue?.channel) {
			ctx.services.activity.setVoiceChannelStatus(ctx.client, queue.channel, "");
		}
	},
};
