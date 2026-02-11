/**
 * Resume command - resumes playback.
 */

const { useQueue } = require("discord-player");
const { createLogger } = require("../../core/logger");

const log = createLogger("resume");

module.exports = {
	name: "resume",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			log.debug("Resume requested but no queue (guild:", message.guild.id, ")");
			return message.reply("There is no music playing right now!");
		}

		log.info("Resuming playback (guild:", message.guild.id, ")");
		queue.node.setPaused(false);
		return message.reply("▶️ Playback has been resumed.");
	},
};
