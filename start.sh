#!/bin/bash

echo "Starting BgUtil PO Token Provider Server..."
cd bgutil-ytdlp-pot-provider/server
node build/main.js &
PO_PROVIDER_PID=$!
cd ../..

echo "PO Token Provider started (PID: $PO_PROVIDER_PID)"
echo "Waiting 5 seconds for provider to initialize..."
sleep 5

echo ""
echo "Starting zen-bot..."
node main.js

# When zen-bot stops, also stop the PO provider
echo ""
echo "Stopping PO Token Provider..."
kill $PO_PROVIDER_PID 2>/dev/null
