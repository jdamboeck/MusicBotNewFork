#!/usr/bin/env bash
set -e
git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
# Install plugin into project yt-dlp-plugins so yt-dlp (next to ./yt-dlp binary) loads it
mkdir -p yt-dlp-plugins/bgutil-ytdlp-pot-provider
cp -r bgutil-ytdlp-pot-provider/plugin/* yt-dlp-plugins/bgutil-ytdlp-pot-provider/
cd bgutil-ytdlp-pot-provider/server && npm install && npx tsc
