FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    libass9 \
    libfreetype6 \
    libfontconfig1 \
    fonts-dejavu-core \
    fontconfig \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -filters 2>&1 | grep subtitles && echo "subtitles filter OK"

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install

# FIX: COPY server/ happens BEFORE mkdir, so mp3s in server/public/audio/ are included
COPY server/ .

# Safety-net: ensure dirs exist even if empty
RUN mkdir -p uploads outputs temp public/audio

EXPOSE 8000
CMD ["node", "index.js"]