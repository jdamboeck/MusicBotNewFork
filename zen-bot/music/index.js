/**
 * Music feature - Player initialization and extractor registration.
 */

const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { createLogger } = require("../core/logger");
const { YtDlpExtractor } = require("./extractor");
const config = require("./config");

const log = createLogger("music");

/**
 * Initialize the music feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
	log.info("Initializing music...");

	// Initialize the Player with audio quality settings
	ctx.player = new Player(ctx.client, {
		ytdlOptions: {
			quality: "highestaudio",
			highWaterMark: 1 << 25,
		},
	});

	// Register extractors
	log.info("Loading extractors...");
	await ctx.player.extractors.register(YtDlpExtractor, {});
	await ctx.player.extractors.loadMulti(DefaultExtractors);

	log.info(
		"Extractors loaded:",
		ctx.player.extractors.store.map((e) => e.identifier)
	);

	// Store config for commands
	ctx.musicConfig = config;

	log.info("Music initialized");
}

module.exports = { init };
