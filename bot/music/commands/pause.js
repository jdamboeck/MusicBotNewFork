/**
 * Pause command - pauses playback.
 */

const { useQueue } = require("discord-player");

module.exports = {
	name: "pause",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			return message.reply("There is no music playing right now!");
		}

		queue.node.setPaused(true);
		return message.reply("⏸️ Playback has been paused.");
	},
};
