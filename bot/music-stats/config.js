/**
 * Music stats configuration - defaults with env overrides.
 */

const path = require("path");

module.exports = {
	dbPath: process.env.DB_PATH || path.join(__dirname, "..", "..", "musicstats.db"),
};
