const { Client, GatewayIntentBits } = require("discord.js");
const { ActivityType } = require("discord-api-types/v10");
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

// Keep bot activity in sync with the currently playing track (Discord allows 128 chars each for name and state)
const MAX_ACTIVITY_LEN = 128;
function truncate(str, max = MAX_ACTIVITY_LEN) {
	return str && str.length > max ? str.slice(0, max - 3) + "..." : str;
}
function setBotActivity(activityOrName) {
	if (!client.user) return;
	if (!activityOrName) {
		client.user.setActivity(null);
		return;
	}
	if (typeof activityOrName === "string") {
		client.user.setActivity(truncate(activityOrName));
		return;
	}
	// Full activity: { name, state?, type?, url? }
	const name = truncate(activityOrName.name);
	const state = activityOrName.state != null ? truncate(String(activityOrName.state)) : undefined;
	const opts = { type: activityOrName.type ?? ActivityType.Playing, state };
	if (activityOrName.url) opts.url = activityOrName.url;
	client.user.setActivity(name, opts);
}

function isYouTubeUrl(url) {
	if (!url || typeof url !== "string") return false;
	try {
		const u = new URL(url);
		return u.hostname === "youtube.com" || u.hostname === "www.youtube.com" || u.hostname === "youtu.be";
	} catch {
		return false;
	}
}

player.events.on("playerStart", (queue, track) => {
	const channel = queue.channel;
	const listeners = channel?.members?.filter((m) => !m.user.bot).size ?? 0;
	const channelName = channel?.name ?? "voice";
	const state = `to ${listeners} listener${listeners !== 1 ? "s" : ""} in #${channelName}`;
	const isYoutube = isYouTubeUrl(track.url);
	setBotActivity({
		name: track.title,
		state,
		type: isYoutube ? ActivityType.Streaming : ActivityType.Listening,
		...(isYoutube && track.url && { url: track.url }),
	});
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
