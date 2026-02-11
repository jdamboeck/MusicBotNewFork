/**
 * Play command - plays music from YouTube.
 */

const { useQueue } = require("discord-player");
const { createLogger } = require("../../core/logger");

const log = createLogger("play");

module.exports = {
	name: "play",
	aliases: ["p"],

	async execute(message, args, ctx) {
		const query = args.join(" ");
		log.info(`Attempting to play: ${query}`);

		if (!query) {
			log.debug("Play called without query");
			return message.reply("🛑 Link missing");
		}

		const channel = message.member.voice.channel;
		if (!channel) {
			log.debug("Play refused: user not in voice channel");
			return message.reply("You need to be in a voice channel!");
		}

		try {
			const { track } = await ctx.player.play(channel, query, {
				nodeOptions: {
					metadata: message,
					volume: ctx.musicConfig.volume,
					leaveOnEmpty: true,
					leaveOnEmptyCooldown: ctx.musicConfig.leaveOnEmptyCooldown,
					leaveOnEnd: true,
					leaveOnEndCooldown: ctx.musicConfig.leaveOnEndCooldown,
					selfDeaf: false, // Must be false for soundboard to work
				},
			});

			// Send the enqueued message
			const enqueuedMessage = await message.reply(`**${track.title}** enqueued!`);

			// Store enqueued message in queue metadata for track comments
			const queue = useQueue(message.guild.id);
			if (queue?.metadata) {
				queue.metadata.enqueuedMessage = enqueuedMessage;
			}

			log.info("Enqueued:", track.title, "| guild:", message.guild.id);
			return enqueuedMessage;
		} catch (e) {
			log.error("Play failed:", e);
			return message.reply(`Something went wrong: ${e.message}`);
		}
	},
};
