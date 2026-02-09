FROM node:20-alpine

RUN apk add --no-cache git ffmpeg

WORKDIR /app

# Invalidate cache when main branch changes
ADD https://api.github.com/repos/jdamboeck/MusicBotNewFork/git/ref/heads/main version.json

RUN git init && \
    git remote add origin https://github.com/jdamboeck/MusicBotNewFork.git && \
    git fetch --depth 1 origin main && \
    git checkout -b main --track origin/main

RUN npm install

RUN cd bgutil-ytdlp-pot-provider/server && npm install && npm run build

RUN chmod +x start.sh

# Set BOT_TOKEN at runtime: docker run -e BOT_TOKEN=your_token ...
CMD ["./start.sh"]
