FROM node:20-bookworm-slim

# Runtime deps + build deps for canvas (PO provider server); Debian/glibc avoids Alpine/musl canvas build issues
# python3-pip + yt-dlp[default] for YouTube EJS (JS runtime) support; path resolution prefers system yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git ffmpeg python3 python3-pip \
    build-essential pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libpng-dev libgif-dev librsvg2-dev \
    && python3 -m pip install --break-system-packages -U "yt-dlp[default]" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy application files
COPY . .

RUN npm install

RUN chmod +x start.sh

# Set BOT_TOKEN at runtime: docker run -e BOT_TOKEN=your_token ...
CMD ["./start.sh"]
