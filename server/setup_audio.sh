#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-audio.sh  —  Download free background music for your video editor
# Run from your BACKEND folder:  bash setup-audio.sh
# ─────────────────────────────────────────────────────────────────────────────
# All tracks are from Pixabay (free for commercial use, no attribution needed)
# ─────────────────────────────────────────────────────────────────────────────

set -e
AUDIO_DIR="./public/audio"
mkdir -p "$AUDIO_DIR"
echo "📁 Saving to: $AUDIO_DIR"
echo ""

# ── TRACK 1: Chill Lofi Beat ────────────────────────────────────────────────
echo "⬇️  Downloading chill-lofi.mp3..."
curl -L -o "$AUDIO_DIR/chill-lofi.mp3" \
  "https://cdn.pixabay.com/audio/2022/10/25/audio_12adeab55c.mp3"
echo "   ✓ chill-lofi.mp3"

# ── TRACK 2: Uplifting Corporate ────────────────────────────────────────────
echo "⬇️  Downloading uplifting-corporate.mp3..."
curl -L -o "$AUDIO_DIR/uplifting-corporate.mp3" \
  "https://cdn.pixabay.com/audio/2022/01/18/audio_d0c6ff1fbb.mp3"
echo "   ✓ uplifting-corporate.mp3"

# ── TRACK 3: Cinematic Ambient ──────────────────────────────────────────────
echo "⬇️  Downloading cinematic-ambient.mp3..."
curl -L -o "$AUDIO_DIR/cinematic-ambient.mp3" \
  "https://cdn.pixabay.com/audio/2022/03/15/audio_d0e3e6e6fa.mp3"
echo "   ✓ cinematic-ambient.mp3"

echo ""
echo "✅ Done! All 3 audio tracks downloaded to $AUDIO_DIR"
echo ""
echo "📋 Files:"
ls -lh "$AUDIO_DIR"
echo ""
echo "🚀 Now restart your backend and the Music tab will show real playable tracks."
echo "   The files will also be mixed into exports using ffmpeg."