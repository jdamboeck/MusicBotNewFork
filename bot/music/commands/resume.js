/**
 * Resume command - resumes playback.
 */

const { useQueue } = require("discord-player");

module.exports = {
	name: "resume",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			return message.reply("There is no music playing right now!");
		}

		queue.node.setPaused(false);
		return message.reply("▶️ Playback has been resumed.");
	},
};
