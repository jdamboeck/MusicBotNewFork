/**
 * Message reaction add event - records reactions on the tracked enqueued message.
 * Discord.js v14 emits (reaction, user, details); the loader appends ctx as fourth arg.
 */

const services = require("../services");

module.exports = {
	event: "messageReactionAdd",
	target: "client",

	async handle(reaction, user, _details, ctx) {
		return services.handleReactionAdd(reaction, user, ctx);
	},
};
