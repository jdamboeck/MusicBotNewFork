/**
 * Message create event - handles replies to tracked "enqueued" messages.
 */

const services = require("../services");

module.exports = {
	event: "messageCreate",
	target: "client",

	async handle(message, ctx) {
		// Let the command handler run first - if it returns true, it handled the message
		// This event handler only processes replies to tracked messages
		return services.handlePotentialReply(message, ctx);
	},
};
