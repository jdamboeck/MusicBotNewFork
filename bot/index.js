// Re-export all bot modules for convenience
module.exports = {
	...require("./activity"),
	...require("./soundboard"),
	...require("./playerEvents"),
	...require("./commands"),
};
