const { Client, GatewayIntentBits } = require("discord.js");
const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { YtDlpExtractor } = require("./ytdlp-extractor");
const { registerPlayerEvents } = require("./bot/playerEvents");
const { registerCommands } = require("./bot/commands");
const { handlePotentialReply } = require("./bot/trackComments");

// Load bot token from environment or config
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

// Initialize Discord client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates, // Required for audio
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent, // Required if using prefix commands
	],
});

// Initialize the Player with audio quality settings
const player = new Player(client, {
	ytdlOptions: {
		quality: "highestaudio",
		highWaterMark: 1 << 25,
	},
});

// Register event handlers and commands
registerPlayerEvents(player, client);
registerCommands(client, player);

// Register track comment reply listener
client.on("messageCreate", (message) => {
	// Handle potential replies to tracked "enqueued" messages
	handlePotentialReply(message);
});

// Initialize extractors and login
async function init() {
	console.log("Loading extractors...");

	await player.extractors.register(YtDlpExtractor, {});
	await player.extractors.loadMulti(DefaultExtractors);

	console.log(
		"\n✅ All Extractors loaded:",
		player.extractors.store.map((e) => e.identifier),
	);

	await client.login(botToken);
}

init().catch(console.error);
