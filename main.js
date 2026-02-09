const { Client, GatewayIntentBits } = require("discord.js");
const { Player, useQueue } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { YtDlpExtractor } = require("./ytdlp-extractor");
let botToken = process.env.BOT_TOKEN;
if (!botToken) {
	try {
		botToken = require("./env.json").botToken;
	} catch (e) {
		if (e.code === "MODULE_NOT_FOUND" || (e.message && e.message.includes("JSON"))) {
			console.error("Missing or invalid env.json. Copy env.example.json to env.json and set your botToken (or set BOT_TOKEN env var).");
			process.exit(1);
		}
		throw e;
	}
}
if (!botToken) {
	console.error("env.json must contain botToken (or set BOT_TOKEN env var).");
	process.exit(1);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates, // Required for audio
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent, // Required if using prefix commands
	],
});

const prefix = "#";

// Initialize the Player with audio quality settings
const player = new Player(client, {
	ytdlOptions: {
		quality: "highestaudio",
		highWaterMark: 1 << 25,
	},
});

player.events.on("error", (queue, error) => {
	console.error(`Error emitted from the queue: ${error.message}`);
});
player.events.on("playerError", (queue, error) => {
	console.error(`Audio player error: ${error.message}`);
});

// Keep bot activity in sync with the currently playing track (Discord allows 128 chars for activity name)
const MAX_ACTIVITY_NAME = 128;
function setBotActivity(name) {
	if (!client.user) return;
	const text = name && name.length > MAX_ACTIVITY_NAME ? name.slice(0, MAX_ACTIVITY_NAME - 3) + "..." : name;
	client.user.setActivity(text || null);
}
player.events.on("playerStart", (_queue, track) => {
	setBotActivity(track.title);
});
player.events.on("emptyQueue", () => {
	setBotActivity(null);
});

// This "extracts" the stream from URLs (YouTube, etc.)

async function init() {
	console.log("Loading extractors...");

	// DON'T load default extractors to test our custom one
	await player.extractors.register(YtDlpExtractor, {});
	await player.extractors.loadMulti(DefaultExtractors);

	console.log(
		"\n✅ All Extractors loaded:",
		player.extractors.store.map((e) => e.identifier),
	);

	await client.login(botToken);
}

client.on("messageCreate", async (message) => {
	if (message.author.bot || !message.content.startsWith(prefix)) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
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
						selfDeaf: true,
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

			queue.delete();
			setBotActivity(null);
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

init().catch(console.error);
