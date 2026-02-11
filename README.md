# zen-bot for Discord

<p align="center">
  <img src="assets/logo.svg" alt="zen-bot logo" width="128" />
</p>

An expandable and zen approach to Discord bots.

Built with a feature-based architecture that keeps things simple: **automatism over configuration, minimalism over complexity**.

> **Disclaimer:** This project was built under extreme vibe coding conditions. May contain traces of flow state, questionable variable names past 2am, and the conviction that *this time* the architecture is definitely the right one. Use with appropriate levels of chill.

## Features

**Music Playback**
- Play audio from YouTube (and other sources) via `yt-dlp`
- PO token support to bypass YouTube bot detection
- Queue management with pause/resume/stop

**Music Stats**
- Track play history per guild
- View top tracks and top listeners
- Per-user and global statistics

**Music Comments**
- Reply to the "enqueued" message while music plays
- Comments are saved with their timestamp
- Comments replay automatically on future plays

**Moderation**
- Bulk message deletion

## Requirements

- **Node.js** 18+
- **FFmpeg** (used by discord-player for audio)
- **Discord bot token** ([Discord Developer Portal](https://discord.com/developers/applications))
- **yt-dlp**: installed on your system or downloaded automatically by postinstall

## Installation

```bash
git clone <this-repo>
cd zen-bot
npm install
```

Configure your bot token (see [Configuration](#configuration)), then run zen-bot.

## Configuration

### Bot Token

Use either:

- **Environment variable:** `BOT_TOKEN=your_token_here`
- **File:** Copy `env.example.json` to `env.json` and set `botToken`:

  ```json
  {
    "botToken": "YOUR_DISCORD_BOT_TOKEN_HERE"
  }
  ```

Do not commit `env.json`; it is listed in `.gitignore`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_TOKEN` | — | Discord bot token (required) |
| `PREFIX` | `#` | Command prefix |
| `LOG_LEVEL` | `debug` | Logging level: debug, info, warn, error |
| `MUSIC_VOLUME` | `80` | Default playback volume (0-100) |
| `MUSIC_LEAVE_ON_EMPTY_COOLDOWN` | `30000` | Leave empty channel after (ms) |
| `MUSIC_LEAVE_ON_END_COOLDOWN` | `30000` | Leave after queue ends (ms) |
| `PO_TOKEN_URL` | `http://127.0.0.1:4416` | PO token provider URL |
| `PO_TOKEN_TTL_HOURS` | `6` | Token cache duration |
| `DB_PATH` | `zen-bot.db` | SQLite database file path |

### Discord Bot Setup

In the Discord Developer Portal, enable:

- **Message Content Intent** (required for prefix commands)
- **Server Members Intent** (if you need member info)

Invite the bot with scopes: `bot`, and permissions: **Connect**, **Speak**, **Send Messages**, **Read Message History**.

## Usage

### Run with PO Token Provider (Recommended)

Starts the BgUtil PO token provider (for YouTube), then zen-bot:

**Linux / macOS:**

```bash
npm run start:full
# or directly:
./start.sh
```

**Windows:**

```cmd
start.bat
```

### Run zen-bot Only

If the PO token provider is already running or you don't need it:

```bash
npm start
```

## Commands

Default prefix: `#`

| Command | Aliases | Description |
|---------|---------|-------------|
| `#play <query>` | `#p` | Play a track (URL or search term) |
| `#stop` | — | Stop playback and clear queue |
| `#pause` | — | Pause playback |
| `#resume` | — | Resume playback |
| `#musicstats` | — | Show play statistics |
| `#clearmusicstats` | — | Clear all music stats |
| `#clearcomments` | — | Clear all track comments |
| `#clearvideo` | — | Clear comments for current track |
| `#clear <n>` | — | Delete last n messages (max 100) |

You must be in a voice channel to use `#play`.

### Track Comments

While music plays, reply to the "**[track] enqueued!**" message. Your reply is saved with its timestamp. Next time that track plays, your comment appears at the same moment.

## Docker

Build the image:

```bash
docker build -t zen-bot .
```

Run with your token:

```bash
docker run --rm -e BOT_TOKEN=your_token_here zen-bot
```

The image runs both the PO token provider and zen-bot. FFmpeg, Python, and all dependencies are included.

### CapRover

Deploy using the included `captain-definition`. Set `BOT_TOKEN` in the app's environment variables.

## How It Works

- **discord-player** handles queues and audio
- **yt-dlp** resolves and streams media via a custom extractor
- **PO token provider** ([bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)) provides proof-of-origin tokens to avoid YouTube 403 errors
- **yt-dlp path resolution**: system PATH → project-root binary (downloaded by postinstall)
- **yt-dlp plugins** load from `yt-dlp-plugins/` directory

### Postinstall Scripts

When you run `npm install`:

1. **`ensure-bgutil-plugin.js`** — Clones, builds, and sets up the PO token provider
2. **`ensure-yt-dlp.js`** — Downloads yt-dlp binary if not installed system-wide

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Missing or invalid env.json | Set `BOT_TOKEN` env var or create `env.json` |
| EACCES on yt-dlp | Run `chmod +x yt-dlp` or install yt-dlp system-wide |
| 403 from YouTube | Ensure PO token provider is running (`start:full`) |
| No audio | Ensure FFmpeg is installed and on PATH |
| Plugin not loading | Re-run `npm install` to rebuild plugins |

## Architecture

zen-bot uses a feature-based architecture. See [CONTRIBUTING.md](CONTRIBUTING.md) for developer documentation.

```
zen-bot/
├── index.js          # Feature loader
├── core/             # Core feature (client, commands, services, database)
├── music/            # Music playback
├── music-stats/      # Play history tracking
├── music-comments/   # Timestamp comments
└── moderation/       # Message moderation
```

## License

See repository or subprojects for license information.
