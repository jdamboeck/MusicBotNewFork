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
			case "clear": {
				// Check if user has permission to manage messages in this channel
				if (!message.member.permissionsIn(message.channel).has("ManageMessages")) {
					return message.reply("🛑 You need the 'Manage Messages' permission to use this command.");
				}

				// Check if bot has permission to manage messages
				if (!message.guild.members.me.permissionsIn(message.channel).has("ManageMessages")) {
					return message.reply("🛑 I don't have permission to delete messages in this channel.");
				}

				const amount = parseInt(args[0]) || 100; // Default to 100 messages
				const deleteCount = Math.max(amount, 1); // Minimum 1, no upper limit

				try {
					const statusMsg = await message.channel.send(`🗑️ Clearing messages...`);
					let totalDeleted = 0;
					let remaining = deleteCount;

					// 14 days in milliseconds
					const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

					while (remaining > 0) {
						// Fetch messages (max 100 per request)
						const fetchCount = Math.min(remaining, 100);
						const messages = await message.channel.messages.fetch({ limit: fetchCount });

						if (messages.size === 0) break;

						// Filter out the status message
						const toDelete = messages.filter(m => m.id !== statusMsg.id);
						if (toDelete.size === 0) break;

						// Separate messages into recent (< 14 days) and old (>= 14 days)
						const recentMessages = [];
						const oldMessages = [];

						for (const [id, msg] of toDelete) {
							if (msg.createdTimestamp > fourteenDaysAgo) {
								recentMessages.push(msg);
							} else {
								oldMessages.push(msg);
							}
						}

						// Bulk delete recent messages (if more than 1)
						if (recentMessages.length > 1) {
							const deleted = await message.channel.bulkDelete(recentMessages, true);
							totalDeleted += deleted.size;
							remaining -= deleted.size;
						} else if (recentMessages.length === 1) {
							// Delete single recent message individually
							await recentMessages[0].delete();
							totalDeleted++;
							remaining--;
						}

						// Delete old messages individually with rate limit handling
						for (const msg of oldMessages) {
							if (remaining <= 0) break;
							try {
								await msg.delete();
								totalDeleted++;
								remaining--;
								// Small delay to avoid rate limits
								await new Promise(resolve => setTimeout(resolve, 300));
							} catch (e) {
								// Skip if message already deleted
								if (e.code !== 10008) console.error(`Failed to delete message: ${e.message}`);
							}
						}

						// Update status periodically
						await statusMsg.edit(`🗑️ Clearing messages... (${totalDeleted} deleted)`).catch(() => {});

						// If we fetched fewer messages than requested, we've hit the end
						if (messages.size < fetchCount) break;
					}

					await statusMsg.edit(`🗑️ Cleared ${totalDeleted} messages.`);
					// Auto-delete the confirmation after 3 seconds
					setTimeout(() => statusMsg.delete().catch(() => {}), 3000);
				} catch (e) {
					console.error(e);
					return message.reply(`Failed to clear messages: ${e.message}`);
				}
				break;
			}
		}
	});
}

module.exports = {
	PREFIX,
	registerCommands,
};
