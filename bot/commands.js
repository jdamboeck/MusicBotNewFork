const { useQueue } = require("discord-player");
const { setBotActivity, setVoiceChannelStatus } = require("./activity");

const PREFIX = "#";

/**
 * Register message command handlers.
 * @param {import("discord.js").Client} client
 * @param {import("discord-player").Player} player
 */
function registerCommands(client, player) {
	client.on("messageCreate", async (message) => {
		if (message.author.bot || !message.content.startsWith(PREFIX)) return;

		const args = message.content.slice(PREFIX.length).trim().split(/ +/);
		const command = args.shift().toLowerCase();
		const queue = useQueue(message.guild.id);

		console.log(`Command: ${command}, Args: ${args.join(" ")}`);

		switch (command) {
			case "play": {
				const query = args.join(" ");
				console.log(`Attempting to play: ${query}`);
				if (!query) return message.reply("🛑 Link missing");

				// Get the voice channel of the user
				const channel = message.member.voice.channel;
				if (!channel) return message.reply("You need to be in a voice channel!");

				try {
					const { track } = await player.play(channel, query, {
						nodeOptions: {
							metadata: message,
							volume: 50, // 0-200, default is 100
							leaveOnEmpty: true,
							leaveOnEmptyCooldown: 60000,
							leaveOnEnd: true,
							leaveOnEndCooldown: 60000,
							selfDeaf: false, // must be false for soundboard to work
						},
					});

					return message.reply(`**${track.title}** enqueued!`);
				} catch (e) {
					console.error(e);
					return message.reply(`Something went wrong: ${e.message}`);
				}
			}
			case "stop": {
				if (!queue) return message.reply("There is no music playing!");
				const vc = queue.channel;
				queue.delete();
				setBotActivity(client, null);
				if (vc) setVoiceChannelStatus(client, vc, "");
				return message.reply("Stopped the player and cleared the queue!");
			}
			case "pause": {
				if (!queue) return message.reply("There is no music playing right now!");
				queue.node.setPaused(true);
				return message.reply("⏸️ Playback has been paused.");
			}
			case "resume": {
				if (!queue) return message.reply("There is no music playing right now!");
				queue.node.setPaused(false);
				return message.reply("▶️ Playback has been resumed.");
			}
		}
	});
}

module.exports = {
	PREFIX,
	registerCommands,
};
