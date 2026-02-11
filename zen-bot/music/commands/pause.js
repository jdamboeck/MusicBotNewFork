/**
 * Pause command - pauses playback.
 */

const { useQueue } = require("discord-player");
const { createLogger } = require("../../core/logger");

const log = createLogger("pause");

module.exports = {
	name: "pause",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			log.debug("Pause requested but no queue (guild:", message.guild.id, ")");
			return message.reply("There is no music playing right now!");
		}

		log.info("Pausing playback (guild:", message.guild.id, ")");
		queue.node.setPaused(true);
		return message.reply("⏸️ Playback has been paused.");
	},
};
