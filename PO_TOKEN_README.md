# MusicBot with PO Token Support

## Setup Instructions

### 1. Start the PO Token Provider Server

Before running the bot, you need to start the PO token provider server:

```bash
# Run this in a separate terminal/command prompt
start-po-provider.bat
```

Or manually:

```bash
cd bgutil-ytdlp-pot-provider/server
node build/main.js
```

The server will start on `http://127.0.0.1:4416` by default.

### 2. Verify yt-dlp Installation

Make sure `yt-dlp` is installed and accessible:

```bash
yt-dlp --version
```

If not installed, download from: https://github.com/yt-dlp/yt-dlp/releases

### 3. Run the Bot

```bash
node main.js
```

## How It Works

1. **PO Token Provider**: The `bgutil-ytdlp-pot-provider` server generates Proof-of-Origin tokens that help bypass YouTube's bot detection.

2. **Token Caching**: PO tokens are cached for 6 hours to reduce server requests.

3. **Automatic Integration**: The `ytdlp-extractor.js` automatically fetches and applies PO tokens when streaming YouTube videos.

4. **Fallback**: If the PO token provider is unavailable, the bot will still attempt to download without tokens (may result in 403 errors on flagged IPs).

## Configuration

### Change Provider Port

Edit `start-po-provider.bat` and add `--port <PORT>`:

```bash
node build/main.js --port 8080
```

Then update `po-token-provider.js` line 11:

```javascript
async function fetchPoToken(baseUrl = 'http://127.0.0.1:8080', visitorData = null) {
```

### Token TTL

Modify the cache TTL in `ytdlp-extractor.js` line 5:

```javascript
const poTokenCache = new PoTokenCache(12); // 12 hours instead of 6
```

## Troubleshooting

- **Provider not running**: Make sure the provider server is started before the bot
- **403 errors**: PO tokens may need to be refreshed or YouTube may require cookies
- **No audio**: Check yt-dlp logs in console for specific errors
