/**
 * Soundboard playback helper.
 */

const { createLogger } = require("../logger");

const log = createLogger("soundboard");

/**
 * Duration to show the soundboard icon before switching to track info.
 */
const SOUNDBOARD_ICON_DURATION_MS = 2000;

/**
 * Play the server's first soundboard sound (slot 1) in the voice channel.
 * Uses Discord's native soundboard API.
 * @param {import("discord.js").Guild} guild
 * @param {import("discord.js").VoiceChannel} voiceChannel
 */
async function tryPlaySoundboardSlot1(guild, voiceChannel) {
	const hasGuild = !!guild?.soundboardSounds;
	const hasSend = typeof voiceChannel?.sendSoundboardSound === "function";
	log.debug("tryPlaySoundboardSlot1 called", {
		guildId: guild?.id ?? null,
		channelId: voiceChannel?.id ?? null,
		hasGuildSoundboardManager: hasGuild,
		hasSendSoundboardSound: hasSend,
	});
	if (!hasGuild || !hasSend) {
		log.debug("Skipping: missing guild soundboard manager or channel.sendSoundboardSound");
		return;
	}
	try {
		const sounds = await guild.soundboardSounds.fetch();
		const slot1 = sounds.first();
		log.debug("Fetched sounds:", sounds.size, "first:", slot1 ? { id: slot1.soundId, name: slot1.name } : null);
		if (!slot1) {
			log.debug("No guild soundboard sounds – add custom sounds in Server Settings → Soundboard");
			return;
		}
		const payload = { soundId: slot1.soundId, ...(slot1.guildId && { guildId: slot1.guildId }) };
		log.debug("Sending sound to voice channel:", payload);
		await voiceChannel.sendSoundboardSound(payload);
		log.debug("Sent soundboard sound successfully");
	} catch (e) {
		log.warn("Error:", e.message || e);
	}
}

module.exports = {
	SOUNDBOARD_ICON_DURATION_MS,
	tryPlaySoundboardSlot1,
};
