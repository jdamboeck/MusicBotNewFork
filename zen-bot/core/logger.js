/**
 * Simple logger factory - no dependencies, no config files.
 * Usage: const log = require('./logger'); log.info('message');
 * Control via LOG_LEVEL env var: debug, info, warn, error (default: debug)
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.debug;

/**
 * Create a logger with a name prefix.
 * @param {string} name - Logger name (appears in brackets)
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
function createLogger(name) {
	const prefix = `[${name}]`;
	return {
		debug: (...args) => currentLevel <= LOG_LEVELS.debug && console.debug(prefix, ...args),
		info: (...args) => currentLevel <= LOG_LEVELS.info && console.log(prefix, ...args),
		warn: (...args) => currentLevel <= LOG_LEVELS.warn && console.warn(prefix, ...args),
		error: (...args) => currentLevel <= LOG_LEVELS.error && console.error(prefix, ...args),
	};
}

module.exports = { createLogger };
