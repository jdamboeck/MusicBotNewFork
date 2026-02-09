# MusicBotNewFork

Discord music bot that plays audio from YouTube (and other sources) using **yt-dlp**, with optional **PO token** support to help with YouTube bot detection.

## Requirements

- **Node.js** 18+
- **FFmpeg** (used by discord-player for audio)
- **Discord bot token** ([Discord Developer Portal](https://discord.com/developers/applications))
- **yt-dlp**: either installed on your system, provided by the `youtube-dl-exec` npm package (installed with the project), or a vendored `yt-dlp` binary in the project root (must be executable)

## Installation

```bash
git clone <this-repo>
cd MusicBotNewFork
npm install
```

Configure your bot token (see [Configuration](#configuration)), then run the bot.

## Configuration

### Bot token

Use either:

- **Environment variable:** `BOT_TOKEN=your_token_here`
- **File:** Copy `env.example.json` to `env.json` and set `botToken`:

  ```json
  {
    "botToken": "YOUR_DISCORD_BOT_TOKEN_HERE"
  }
  ```

Do not commit `env.json`; it is listed in `.gitignore`.

### Discord bot setup

In the Discord Developer Portal, enable:

- **Message Content Intent** (required for prefix commands)
- **Server Members Intent** if you need member info

Invite the bot to your server with scopes: `bot`, and permissions: **Connect**, **Speak**, **Send Messages**, **Use Slash Commands** (if you add them later).

## Usage

### Run bot + PO token provider (recommended for YouTube)

Starts the BgUtil PO token provider (for YouTube), then the music bot. Use this if you want the best chance of avoiding YouTube 403s:

```bash
npm run start:full
```

Or directly:

```bash
./start.sh
```

The first run will install server dependencies and build the provider if needed.

### Run bot only

If the PO token provider is already running (e.g. in another terminal or as a service), or you do not need it:

```bash
npm start
```

The provider listens on `http://127.0.0.1:4416` by default. To use another host/port, set it in `po-token-provider.js` and when starting the provider (e.g. `node build/main.js --port 8080`).

## Docker

Build the image (from the project root):

```bash
docker build -t music-bot .
```

Run the container. Pass your Discord bot token via the `BOT_TOKEN` environment variable (replace with your real token):

```bash
docker run --rm -e BOT_TOKEN=your_discord_bot_token_here music-bot
```

The image runs both the PO token provider and the bot (same as `./start.sh`). FFmpeg, Python, and the canvas build dependencies for the provider are included.

For **CapRover** (or other PaaS using captain-definition), deploy the app and set `BOT_TOKEN` in the app’s environment variables. The repo includes a `captain-definition` file that builds from this Dockerfile.

## Commands

All commands use the **`#`** prefix.

| Command   | Description                    |
|----------|--------------------------------|
| `#play <query>` | Play a track. `<query>` can be a YouTube (or other) URL or a search term (e.g. `#play bjork army of me`). |
| `#stop`  | Stop playback and clear the queue. |
| `#pause` | Pause playback.                |
| `#resume`| Resume playback.               |

You must be in a voice channel to use `#play`.

## How it works

- **discord-player** handles queues and audio; **yt-dlp** is used to resolve and stream YouTube (and similar) content via a custom extractor.
- **PO token provider** ([bgutil-ytdlp-pot-provider](bgutil-ytdlp-pot-provider)) runs as a small HTTP service and provides proof-of-origin tokens. The bot fetches a token and passes it to yt-dlp to reduce the chance of YouTube returning 403. Tokens are cached for 6 hours.
- **yt-dlp** is resolved in this order: project-root `yt-dlp` (if executable) → `node_modules/youtube-dl-exec/bin` → system `yt-dlp` in PATH.

## Troubleshooting

- **"Missing or invalid env.json"** — Set `BOT_TOKEN` or create `env.json` from `env.example.json` with your Discord bot token.
- **"Cannot find package 'axios'"** — The PO provider’s dependencies are not installed. Run `npm install` once (root `postinstall` should do it), or run `npm install` inside `bgutil-ytdlp-pot-provider/server` and ensure `build/main.js` exists (`npm run build` there).
- **EACCES on yt-dlp** — The local `yt-dlp` file is not executable. Run `chmod +x yt-dlp` or install yt-dlp system-wide so the fallback to PATH is used.
- **403 from YouTube** — Ensure the PO token provider is running (`npm run start:full` or start it manually). If it still fails, YouTube may be blocking your IP or require other measures (e.g. cookies).
- **No audio** — Ensure FFmpeg is installed and on your PATH.

## License

See repository or subprojects for license information.
