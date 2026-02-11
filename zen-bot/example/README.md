# Example Feature

This feature demonstrates all patterns and conventions in zen-bot.

**Use this as a reference when creating your own features.**

## Structure

```
zen-bot/example/
├── index.js              # Feature entry point (required)
├── config.js             # Configuration with env overrides
├── database.js           # Database namespace registration
├── services.js           # Stateful service module
├── commands/
│   ├── greet.js          # Primary command with aliases
│   ├── greetcount.js     # Command that reads state
│   └── resetgreet.js     # Command that modifies state
├── events/
│   ├── messageCreate.js  # Discord.js event handler
│   ├── ready.js          # One-time startup event
│   └── playerStart.js    # discord-player event handler
└── README.md             # Feature documentation
```

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `#greet` | `#hi`, `#hello` | Get greeted by the bot |
| `#greetcount` | `#gc` | Show your greet count |
| `#resetgreet` | `#rg` | Reset your greet count |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EXAMPLE_GREETING` | `Hello` | Default greeting message |
| `EXAMPLE_MAX_GREETINGS` | `100` | Maximum greets before cooldown |
| `EXAMPLE_COOLDOWN_MS` | `5000` | Cooldown between greets (ms) |
| `EXAMPLE_ENABLED` | `true` | Enable/disable the feature |
| `EXAMPLE_VERBOSE` | `false` | Enable verbose logging |
| `EXAMPLE_SPECIAL_GREETINGS` | `Howdy,Hey there,Greetings` | Special greetings (comma-separated) |

## Patterns Demonstrated

### 1. Feature Entry Point (`index.js`)

```javascript
const { createLogger } = require("../core/logger");
const log = createLogger("my-feature");

async function init(ctx) {
    // Access dependencies from ctx
    // Initialize services
    // Export services to ctx.services
}

module.exports = { init };
```

### 2. Configuration (`config.js`)

```javascript
module.exports = {
    // String with env override
    setting: process.env.MY_SETTING || "default",

    // Number with env override
    timeout: parseInt(process.env.MY_TIMEOUT, 10) || 5000,

    // Boolean (default true, disable with "false")
    enabled: process.env.MY_ENABLED !== "false",

    // Array from comma-separated env
    items: process.env.MY_ITEMS?.split(",") || ["a", "b", "c"],
};
```

### 3. Commands (`commands/[name].js`)

```javascript
module.exports = {
    name: "commandname",
    aliases: ["cn", "cmd"],

    async execute(message, args, ctx) {
        // message: Discord.js Message
        // args: Array of arguments
        // ctx: Shared context
        return message.reply("Response");
    },
};
```

### 4. Events (`events/[eventName].js`)

```javascript
module.exports = {
    event: "messageCreate",    // Event name
    target: "client",          // "client" or "player"

    async handle(message, ctx) {
        // Arguments match event signature
        // ctx is always last
    },
};
```

### 5. Services (`services.js`)

```javascript
const log = createLogger("my-service");
let ctx = null;

function init(context) {
    ctx = context;
}

function doSomething(input) {
    // Business logic here
    return result;
}

module.exports = { init, doSomething };
```

### 6. Database Namespace (`database.js`)

```javascript
const { createLogger } = require("../core/logger");
const log = createLogger("my-feature-db");

function initMyFeatureDatabase(db) {
    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS my_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            data TEXT NOT NULL
        );
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
    };
}

module.exports = { initMyFeatureDatabase };
```

Register in `index.js`:

```javascript
const { initMyFeatureDatabase } = require("./database");

async function init(ctx) {
    ctx.db.register("myFeature", initMyFeatureDatabase);
    // Now available: ctx.db.myFeature.saveData(), ctx.db.myFeature.getData()
}
```

## Events Handled

| Event | Target | Description |
|-------|--------|-------------|
| `messageCreate` | client | Reacts to "good bot" / "bad bot" |
| `ready` | client | Logs startup information |
| `playerStart` | player | Logs when music starts (verbose) |

## Inter-Feature Dependencies

This feature depends on:
- `core` - For Discord client, services, and database context

It must be loaded **after** `core` in `FEATURE_ORDER`.

## Database Namespace

This feature registers the `example` namespace on `ctx.db`:

```javascript
// Available at ctx.db.example
ctx.db.example.saveGreeting({ userId, userName, guildId, greetingText });
ctx.db.example.getGreetingCount(userId, guildId);
ctx.db.example.getTotalGreetings(guildId);
ctx.db.example.getRecentGreetings(guildId, limit);
ctx.db.example.getTopGreeters(guildId, limit);
ctx.db.example.clearUserGreetings(userId, guildId);
ctx.db.example.clearAllGreetings(guildId);
```

The database is persistent - greetings survive bot restarts.

## Enabling the Feature

To enable this example feature, add it to `FEATURE_ORDER` in `zen-bot/index.js`:

```javascript
const FEATURE_ORDER = [
    "core",
    "music",
    "moderation",
    "music-stats",
    "music-comments",
    "example",        // Add this line
];
```

**Note:** The example feature is disabled by default. Enable it only for learning/testing.
