# Contributing to zen-bot

This document explains the architecture and conventions for developing features for zen-bot.

## Philosophy

1. **Automatism over configuration** — Convention eliminates boilerplate
2. **Minimalism** — Every abstraction must earn its place
3. **Simplicity** — Code should be obvious, not clever

## Architecture Overview

```
zen-bot/
├── index.js              # Feature loader (orchestrates everything)
├── core/                 # Core feature
│   ├── index.js          # Feature entry point (init function)
│   ├── config.js         # Feature configuration
│   ├── logger.js         # Shared logger factory
│   ├── commands/         # Command modules
│   │   └── index.js      # Command registry
│   ├── events/           # Event handlers
│   │   └── messageCreate.js
│   └── services/         # Shared services
│       ├── activity.js
│       └── soundboard.js
├── music/                # Music feature
│   ├── index.js
│   ├── config.js
│   ├── extractor.js      # Custom yt-dlp extractor
│   ├── po-token.js       # PO token fetching
│   ├── commands/
│   │   ├── play.js
│   │   ├── stop.js
│   │   ├── pause.js
│   │   └── resume.js
│   └── events/
│       ├── playerStart.js
│       ├── playerError.js
│       ├── error.js
│       └── emptyQueue.js
└── [feature]/            # Your feature here
```

> **Note:** The main application directory is `zen-bot/` (not `bot/`).

## The Context Object (`ctx`)

Features communicate through a shared context object passed to all `init()` functions and event handlers:

```javascript
ctx = {
  client: Client,           // Discord.js client (set by core)
  player: Player,           // discord-player instance (set by music)
  db: {                     // Database context (set by core)
    register: Function,     // Register a namespace: ctx.db.register("name", initFn)
    connection: Database,   // Raw better-sqlite3 connection
    close: Function,        // Close database connection
    music: Object,          // Music namespace (set by music-stats)
    example: Object,        // Example namespace (set by example)
    // ... other feature namespaces
  },
  commands: Map,            // Command registry (set by core)
  services: {               // Shared services
    activity: Object,       // Bot activity/status helpers
    soundboard: Object,     // Soundboard utilities
    comments: Object,       // Comment session management
  },
  config: Object,           // Core config (token, prefix)
  musicConfig: Object,      // Music-specific config
}
```

Features add their exports to `ctx` during initialization. Later features can access them.

## Creating a Feature

### 1. Create the Feature Directory

```
zen-bot/
└── my-feature/
    ├── index.js          # Required: feature entry point
    ├── config.js         # Optional: feature configuration
    ├── commands/         # Optional: command modules
    │   └── mycommand.js
    ├── events/           # Optional: event handlers
    │   └── messageCreate.js
    └── services.js       # Optional: feature services
```

### 2. Register in Feature Order

Edit `zen-bot/index.js` and add your feature to `FEATURE_ORDER`:

```javascript
const FEATURE_ORDER = [
  "core",           // Must be first
  "music",          // Provides player
  "moderation",
  "music-stats",    // Provides database
  "music-comments", // Depends on music-stats
  "my-feature",     // Your feature (add here)
];
```

**Order matters.** Features are loaded sequentially. Place your feature after its dependencies.

### 3. Create `index.js` (Entry Point)

Every feature needs an `index.js` with an `init(ctx)` function:

```javascript
/**
 * My Feature - Brief description.
 */

const { createLogger } = require("../core/logger");

const log = createLogger("my-feature");

/**
 * Initialize the feature.
 * @param {object} ctx - Shared context object
 */
async function init(ctx) {
  log.info("Initializing my-feature...");

  // Access dependencies from ctx
  // ctx.client - Discord client
  // ctx.player - Music player (if music feature loaded)
  // ctx.db     - Database (if music-stats feature loaded)

  // Export services for other features
  ctx.services.myFeature = {
    doSomething: () => { /* ... */ },
  };

  log.info("my-feature initialized");
}

module.exports = { init };
```

## Commands

Commands live in `zen-bot/[feature]/commands/[name].js`.

### Command Structure

```javascript
/**
 * MyCommand - Brief description.
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("mycommand");

module.exports = {
  // Required: primary command name
  name: "mycommand",

  // Optional: alternative names
  aliases: ["mc", "mycmd"],

  // Required: command handler
  async execute(message, args, ctx) {
    // message - Discord.js Message object
    // args    - Array of arguments (command prefix and name stripped)
    // ctx     - Shared context object

    log.info(`Executing with args: ${args.join(", ")}`);

    // Access other features
    const player = ctx.player;
    const db = ctx.db;

    // Reply to user
    return message.reply("Done!");
  },
};
```

### Command Discovery

Commands are auto-discovered by scanning `zen-bot/*/commands/*.js`. No manual registration needed.

The `core` feature's command loader:
1. Scans all feature directories
2. Loads all `.js` files from `commands/` subdirectories
3. Registers primary names and aliases to `ctx.commands`

## Events

Events live in `zen-bot/[feature]/events/[eventName].js`.

### Event Structure

```javascript
/**
 * Handler for [event description].
 */

const { createLogger } = require("../../core/logger");

const log = createLogger("my-feature");

module.exports = {
  // Required: event name
  event: "messageCreate",

  // Required: target (client or player)
  target: "client",  // "client" for Discord events, "player" for discord-player events

  // Required: event handler
  async handle(message, ctx) {
    // Arguments match the event signature
    // ctx is always the last argument

    log.debug(`Received message: ${message.content}`);
  },
};
```

### Client Events (Discord.js)

Target: `"client"`

Common events:
- `ready` - Bot connected
- `messageCreate` - Message received
- `interactionCreate` - Slash command/button interaction
- `guildMemberAdd` - Member joined

### Player Events (discord-player)

Target: `"player"`

Common events:
- `playerStart` - Track started playing
- `playerError` - Playback error
- `error` - Queue error
- `emptyQueue` - Queue finished
- `emptyChannel` - Voice channel empty

### Multiple Handlers

Multiple features can handle the same event. Handlers run in feature load order.

Example: `playerStart` is handled by:
1. `music/events/playerStart.js` - Updates bot activity
2. `music-stats/events/playerStart.js` - Records to database
3. `music-comments/events/playerStart.js` - Schedules comment playback

## Configuration

Feature configuration uses a simple pattern: defaults with environment variable overrides.

### Create `config.js`

```javascript
/**
 * My Feature configuration.
 */

module.exports = {
  // Simple default with env override
  someSetting: process.env.MY_FEATURE_SETTING || "default_value",

  // Numeric setting
  timeout: parseInt(process.env.MY_FEATURE_TIMEOUT, 10) || 5000,

  // Boolean setting
  enabled: process.env.MY_FEATURE_ENABLED !== "false",
};
```

### Use in Feature

```javascript
const config = require("./config");

async function init(ctx) {
  console.log(config.someSetting);
  ctx.myFeatureConfig = config;  // Expose to other features if needed
}
```

## Logger

The logger is a minimal factory that creates prefixed loggers.

### Usage

```javascript
const { createLogger } = require("../core/logger");

const log = createLogger("my-feature");

log.debug("Verbose debugging info");
log.info("General information");
log.warn("Warning message");
log.error("Error occurred", error);
```

### Log Levels

Controlled by `LOG_LEVEL` environment variable (default: `debug`):
- `debug` - All messages (default; use for actions and status changes)
- `info` - Notable events (command executed, feature initialized, etc.)
- `warn` - Recoverable issues (fallbacks, retries)
- `error` - Failures (exceptions, failed operations)

## Services

Services are shared utilities exposed through `ctx.services`.

### Creating a Service

```javascript
// zen-bot/my-feature/services.js

const { createLogger } = require("../core/logger");

const log = createLogger("my-service");

function doSomething(data) {
  log.debug("Doing something with", data);
  return data.toUpperCase();
}

module.exports = { doSomething };
```

### Exposing Services

In your feature's `index.js`:

```javascript
const services = require("./services");

async function init(ctx) {
  ctx.services.myFeature = services;
}
```

### Using Services from Other Features

```javascript
async function execute(message, args, ctx) {
  const result = ctx.services.myFeature.doSomething("hello");
  message.reply(result);
}
```

## Database

The `core` feature provides a shared SQLite database through `ctx.db`. Features register their own **namespaces** to add tables and query functions.

### Database Architecture

```
ctx.db
├── register(namespace, initFn)  # Register a new namespace
├── connection                    # Raw better-sqlite3 connection
├── close()                       # Close connection
├── music                         # Namespace from music-stats
│   ├── recordPlay()
│   ├── getTopVideosOverall()
│   └── ...
└── example                       # Namespace from example feature
    ├── saveGreeting()
    ├── getGreetingCount()
    └── ...
```

### Registering a Database Namespace

Create a `database.js` file in your feature:

```javascript
// zen-bot/my-feature/database.js

const { createLogger } = require("../core/logger");
const log = createLogger("my-feature-db");

/**
 * Initialize the database namespace.
 * @param {import('better-sqlite3').Database} db - Database connection
 * @returns {object} Object with query functions
 */
function initMyFeatureDatabase(db) {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS my_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_my_table_user ON my_table(user_id);
  `);

  log.info("My feature tables initialized");

  // Return query functions
  return {
    saveData({ userId, data }) {
      const stmt = db.prepare("INSERT INTO my_table (user_id, data) VALUES (?, ?)");
      stmt.run(userId, data);
    },

    getData(userId) {
      const stmt = db.prepare("SELECT * FROM my_table WHERE user_id = ?");
      return stmt.all(userId);
    },

    clearData(userId) {
      const stmt = db.prepare("DELETE FROM my_table WHERE user_id = ?");
      return stmt.run(userId).changes;
    },
  };
}

module.exports = { initMyFeatureDatabase };
```

Register in your feature's `index.js`:

```javascript
// zen-bot/my-feature/index.js

const { initMyFeatureDatabase } = require("./database");

async function init(ctx) {
  // Register the namespace
  ctx.db.register("myFeature", initMyFeatureDatabase);

  // Now available: ctx.db.myFeature.saveData(), ctx.db.myFeature.getData(), etc.
}
```

### Using Database Namespaces

In commands and events, access via `ctx.db.[namespace]`:

```javascript
// In a command
async execute(message, args, ctx) {
  // Use music namespace
  const topVideos = ctx.db.music.getTopVideosOverall(guildId, 10);

  // Use your feature's namespace
  ctx.db.myFeature.saveData({ userId: message.author.id, data: "hello" });
}
```

### Existing Namespaces

| Namespace | Feature | Description |
|-----------|---------|-------------|
| `music` | music-stats | Play history and track comments |
| `example` | example | Greeting storage (demo) |

### Best Practices

1. **One namespace per feature** — Keep data ownership clear
2. **Use descriptive method names** — `getTopVideos()` not `get()`
3. **Create indexes** — For columns used in WHERE clauses
4. **Log table creation** — Helps debug initialization issues
5. **Return query objects** — Makes the API discoverable

## Testing Your Feature

1. Start with `LOG_LEVEL=debug` to see all output
2. Use the logger liberally during development
3. Test all commands and event handlers
4. Verify feature dependencies are met

```bash
LOG_LEVEL=debug npm start
```

## Checklist for New Features

- [ ] Create `zen-bot/[feature]/index.js` with `init(ctx)` function
- [ ] Add feature to `FEATURE_ORDER` in `zen-bot/index.js` (after dependencies)
- [ ] Create `config.js` if feature has configurable options
- [ ] Create commands in `commands/` directory
- [ ] Create event handlers in `events/` directory
- [ ] Export services to `ctx.services` if other features need them
- [ ] Use `createLogger()` for all logging
- [ ] Document environment variables in README.md

## Code Style

- Use JSDoc comments for functions
- Log at appropriate levels (debug for verbose, info for important, warn for recoverable issues, error for failures)
- Prefer async/await over callbacks
- Keep functions small and focused
- Name files after their primary export

## Example Feature

See `zen-bot/example/` for a fully documented example feature that demonstrates all patterns.
