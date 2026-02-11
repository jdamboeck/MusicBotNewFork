/**
 * Stop command - stops playback and clears the queue.
 */

const { useQueue } = require("discord-player");
const { createLogger } = require("../../core/logger");

const log = createLogger("stop");

module.exports = {
	name: "stop",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			log.debug("Stop requested but no queue (guild:", message.guild.id, ")");
			return message.reply("There is no music playing!");
		}

		log.info("Stopping player and clearing queue (guild:", message.guild.id, ")");
		const vc = queue.channel;
		queue.delete();

		// Clear activity
		ctx.services.activity.setBotActivity(ctx.client, null);
		if (vc) {
			ctx.services.activity.setVoiceChannelStatus(ctx.client, vc, "");
		}

		return message.reply("Stopped the player and cleared the queue!");
	},
};
