/**
 * Player start event - records play to database.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("music-stats");

module.exports = {
	event: "playerStart",
	target: "player",

	async handle(queue, track, ctx) {
		const channel = queue.channel;
		const guild = channel?.guild;
		const requestedBy = queue.metadata?.author;

		if (requestedBy && guild && track) {
			try {
				log.debug("Recording play (guild:", guild.id, "title:", track.title?.slice(0, 40), "user:", requestedBy.username, ")");
				ctx.db.music.recordPlay({
					videoUrl: track.url,
					videoTitle: track.title,
					userId: requestedBy.id,
					userName: requestedBy.username || requestedBy.tag,
					guildId: guild.id,
				});
			} catch (err) {
				log.error("Failed to record play:", err);
			}
		}
	},
};
