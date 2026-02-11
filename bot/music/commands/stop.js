/**
 * Stop command - stops playback and clears the queue.
 */

const { useQueue } = require("discord-player");

module.exports = {
	name: "stop",

	async execute(message, args, ctx) {
		const queue = useQueue(message.guild.id);
		if (!queue) {
			return message.reply("There is no music playing!");
		}

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
