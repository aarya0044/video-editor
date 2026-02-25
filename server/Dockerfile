# ── Backend Dockerfile ────────────────────────────────────────────────────────
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

# Verify subtitles filter is available (uses libass, always present on Ubuntu 22.04)
RUN ffmpeg -filters 2>&1 | grep subtitles && echo "subtitles filter OK"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads outputs temp public/audio

EXPOSE 5000

CMD ["node", "index.js"]