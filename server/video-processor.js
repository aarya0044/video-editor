import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(
  fs.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : ffmpegStatic
);
if (fs.existsSync("/usr/bin/ffprobe")) {
  ffmpeg.setFfprobePath("/usr/bin/ffprobe");
}

// ── Aspect ratio definitions ─────────────────────────────────────────────────
// Each ratio has base dimensions. Duration scaling shrinks them on free tier.
const RATIO_SIZES = {
  "16:9": { baseW: 1280, baseH: 720  },
  "9:16": { baseW: 720,  baseH: 1280 },
  "1:1":  { baseW: 720,  baseH: 720  },
  "4:5":  { baseW: 720,  baseH: 900  },
};

// ── OPTION 3: Resolution tier based on total timeline duration ───────────────
// Shorter videos get higher quality. Longer videos drop resolution so FFmpeg
// finishes within the free-tier memory/CPU limits.
// The ratio parameter controls the canvas shape (16:9, 9:16, 1:1, 4:5).
//
function getScaleFilter(totalDurationSeconds, ratio = "16:9") {
  const { baseW, baseH } = RATIO_SIZES[ratio] || RATIO_SIZES["16:9"];

  // Scale factor drops for longer videos (free tier memory limit)
  let factor;
  if (totalDurationSeconds < 90)       factor = 1.0;   // full res
  else if (totalDurationSeconds < 180) factor = 0.667; // ~480p equivalent
  else                                 factor = 0.5;   // ~360p equivalent

  const w = Math.round(baseW * factor / 2) * 2; // must be even for libx264
  const h = Math.round(baseH * factor / 2) * 2;

  console.log(`  📐 Output: ${w}×${h} (ratio ${ratio}, duration ${Math.round(totalDurationSeconds)}s)`);

  // For 16:9 → letterbox/pillarbox (shrink to fit, add black bars)
  // For all other ratios → scale to fill then crop to exact canvas size.
  // This ensures 9:16, 1:1, 4:5 exports are fully filled with no black bars.
  let scaleStr;
  if (ratio === "16:9") {
    // Classic letterbox — safe for widescreen content
    scaleStr = `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
               `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  } else {
    // Scale to fill: zoom in to cover the whole canvas, then crop excess
    scaleStr = `scale=${w}:${h}:force_original_aspect_ratio=increase,` +
               `crop=${w}:${h},setsar=1`;
  }

  return {
    scale: scaleStr,
    width: w,
    height: h,
  };
}

// ── OPTION 2: Chunk size in seconds ─────────────────────────────────────────
// Each video clip longer than this will be split and processed in chunks.
// 45 seconds per chunk keeps each FFmpeg job well under 2 minutes on free tier.
const CHUNK_SECONDS = 45;

class VideoProcessor {
  constructor() {
    this.tempDir    = path.join(__dirname, "temp");
    this.outputsDir = path.join(__dirname, "outputs");
    this.uploadsDir = path.join(__dirname, "uploads");
    this.audioDir   = path.join(__dirname, "public", "audio");
    this.currentCmd = null;
    this.cancelled  = false;
    this.ensureDirs();
  }

  ensureDirs() {
    [this.tempDir, this.outputsDir, this.uploadsDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  cancel() {
    this.cancelled = true;
    if (this.currentCmd) {
      try { this.currentCmd.kill("SIGKILL"); console.log("🛑 FFmpeg process killed"); }
      catch (e) { console.warn("⚠️  Could not kill FFmpeg:", e.message); }
      this.currentCmd = null;
    }
  }

  reset() {
    this.cancelled  = false;
    this.currentCmd = null;
  }

  // ── Resolve clip file path ────────────────────────────────────────────────
  resolveFilePath(clip) {
    const raw = clip.src || clip.url || "";

    if (raw.includes("/uploads/")) {
      const file  = decodeURIComponent(raw.split("/uploads/")[1]);
      const full  = path.join(this.uploadsDir, file);
      if (fs.existsSync(full)) return full;
      const ext   = path.extname(file).toLowerCase();
      const base  = path.basename(file, ext);
      const match = fs.readdirSync(this.uploadsDir).find(f =>
        path.extname(f).toLowerCase() === ext &&
        (f === file ||
          path.basename(f, path.extname(f)).startsWith(base) ||
          base.startsWith(path.basename(f, path.extname(f))))
      );
      if (match) return path.join(this.uploadsDir, match);
    }

    if (raw.includes("/audio/")) {
      const file = decodeURIComponent(raw.split("/audio/")[1]);
      const full = path.join(this.audioDir, file);
      if (fs.existsSync(full)) return full;
    }

    if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
    return null;
  }

  // ── ASS time formatter ────────────────────────────────────────────────────
  _fmtTime(sec) {
    const h  = Math.floor(sec / 3600);
    const m  = Math.floor((sec % 3600) / 60);
    const s  = Math.floor(sec % 60);
    const cs = Math.floor((sec % 1) * 100);
    return h + ":" + String(m).padStart(2,"0") + ":" +
           String(s).padStart(2,"0") + "." + String(cs).padStart(2,"0");
  }

  // ── Build ASS subtitle file ───────────────────────────────────────────────
  buildAssFile(textClips, outPath, resWidth = 1280, resHeight = 720) {
    const lines = [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${resWidth}`,
      `PlayResY: ${resHeight}`,
      "WrapStyle: 0",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, " +
        "Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
    ];
    const events = [];

    for (const clip of textClips) {
      const ov = clip.textOverlay;
      if (!ov || !ov.enabled || !ov.text?.trim()) continue;

      const fontSize  = Math.max(8, parseInt(ov.fontSize) || 32);
      const hex       = (ov.fontColor || "#ffffff").replace("#","").padEnd(6,"0");
      const r = hex.slice(0,2), g = hex.slice(2,4), b = hex.slice(4,6);
      const colour    = ("&H00" + b + g + r).toUpperCase();

      let alignment = 5;
      switch (ov.position) {
        case "top-left":     alignment = 7; break;
        case "top-right":    alignment = 9; break;
        case "bottom-left":  alignment = 1; break;
        case "bottom-right": alignment = 3; break;
        default:             alignment = 5; break;
      }

      const styleName = "S" + clip.id.replace(/[^a-zA-Z0-9]/g, "_");
      lines.push(
        "Style: " + styleName + ",Arial," + fontSize + "," +
        colour + ",&H00000000,&H80000000,0,0,1,2,1," +
        alignment + ",10,10,10,1"
      );

      let posTag = "";
      if (ov.position === "custom" && ov.px != null && ov.py != null) {
        posTag = "{\\pos(" + Math.round(ov.px * (resWidth / 100)) + "," +
                 Math.round(ov.py * (resHeight / 100)) + ")}";
      }

      const safeText = String(ov.text)
        .replace(/\r\n/g,"\\N").replace(/\n/g,"\\N").replace(/\r/g,"\\N");

      events.push(
        "Dialogue: 0," + this._fmtTime(clip.start) + "," + this._fmtTime(clip.end) + "," +
        styleName + ",,0,0,0,," + posTag + safeText
      );
    }

    if (events.length === 0) return null;
    lines.push("", "[Events]");
    lines.push("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text");
    events.forEach(e => lines.push(e));
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    return outPath;
  }

  // ── Render one SHORT clip (or chunk) → normalised MP4 ────────────────────
  // OPTION 2: clips longer than CHUNK_SECONDS are automatically chunked by
  // processVideoClipChunked() below — this method handles one chunk at a time.
  _renderSegment(input, outPath, { sourceStart, duration, isImage, isMuted, volume, scaleFilter }) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return reject(new Error("CANCELLED"));

      const SCALE = scaleFilter;
      let cmd = ffmpeg();

      if (isImage) {
        cmd
          .input(input)
          .inputOptions(["-loop","1","-framerate","30"])
          .complexFilter([
            "[0:v]" + SCALE + "[v]",
            "aevalsrc=0:channel_layout=stereo:sample_rate=44100[a]"
          ])
          .outputOptions([
            "-map","[v]","-map","[a]",
            "-t", String(duration),
            "-c:v","libx264","-preset","ultrafast","-crf","28",
            "-c:a","aac","-pix_fmt","yuv420p",
            "-r","30","-ar","44100","-ac","2",
            "-avoid_negative_ts","make_zero"
          ]);

      } else if (isMuted) {
        cmd
          .input(input)
          .inputOptions(["-ss", String(sourceStart)])
          .complexFilter([
            "[0:v]" + SCALE + "[v]",
            "aevalsrc=0:channel_layout=stereo:sample_rate=44100[a]"
          ])
          .outputOptions([
            "-map","[v]","-map","[a]",
            "-t", String(duration),
            "-c:v","libx264","-preset","ultrafast","-crf","28",
            "-c:a","aac","-pix_fmt","yuv420p",
            "-r","30","-ar","44100","-ac","2",
            "-avoid_negative_ts","make_zero"
          ]);

      } else {
        cmd
          .input(input)
          .inputOptions(["-ss", String(sourceStart)])
          .outputOptions([
            "-t", String(duration),
            "-vf", SCALE,
            "-af", "volume=" + volume,
            "-c:v","libx264","-preset","ultrafast","-crf","28",
            "-c:a","aac","-pix_fmt","yuv420p",
            "-r","30","-ar","44100","-ac","2",
            "-avoid_negative_ts","make_zero"
          ]);
      }

      this.currentCmd = cmd;
      cmd
        .output(outPath)
        .on("start", c => console.log("    [seg] " + c.slice(0,120)))
        .on("end",   () => { this.currentCmd = null; resolve(outPath); })
        .on("error", err => {
          this.currentCmd = null;
          if (this.cancelled) return reject(new Error("CANCELLED"));
          reject(new Error("segment: " + err.message));
        })
        .run();
    });
  }

  // ── OPTION 2: Process one clip, chunked if needed ─────────────────────────
  // If the clip duration > CHUNK_SECONDS, it's split into multiple segments
  // which are encoded separately then concatenated. Each segment stays short
  // enough to avoid memory/timeout issues on the free tier.
  async processVideoClipChunked(clip, outPath, scaleFilter, cleanup) {
    if (this.cancelled) throw new Error("CANCELLED");

    const input       = this.resolveFilePath(clip);
    if (!input) throw new Error("File not found: " + clip.name);

    const clipDuration = clip.end - clip.start;
    if (clipDuration <= 0.01) throw new Error("Zero duration: " + clip.name);

    const sourceStart = clip.mediaOffset || 0;
    const isImage     = clip.type?.includes("image") ||
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(input);
    const isMuted     = clip.muted === true;
    const volume      = clip.volume != null ? clip.volume : 1.0;

    // Short clip — render directly, no chunking needed
    if (isImage || clipDuration <= CHUNK_SECONDS) {
      console.log(`    → single segment (${clipDuration.toFixed(1)}s)`);
      await this._renderSegment(input, outPath, {
        sourceStart, duration: clipDuration, isImage, isMuted, volume, scaleFilter
      });
      return;
    }

    // Long clip — split into chunks of CHUNK_SECONDS
    const numChunks = Math.ceil(clipDuration / CHUNK_SECONDS);
    console.log(`    → chunking into ${numChunks} × ${CHUNK_SECONDS}s segments`);

    const chunkPaths = [];
    for (let i = 0; i < numChunks; i++) {
      if (this.cancelled) throw new Error("CANCELLED");

      const chunkStart    = sourceStart + (i * CHUNK_SECONDS);
      const chunkDuration = Math.min(CHUNK_SECONDS, clipDuration - (i * CHUNK_SECONDS));
      const chunkPath     = path.join(
        this.tempDir, `chunk_${Date.now()}_${i}.mp4`
      );
      cleanup.push(chunkPath);
      chunkPaths.push(chunkPath);

      console.log(`    [chunk ${i+1}/${numChunks}] offset=${chunkStart.toFixed(1)}s dur=${chunkDuration.toFixed(1)}s`);
      await this._renderSegment(input, chunkPath, {
        sourceStart: chunkStart,
        duration:    chunkDuration,
        isImage:     false,
        isMuted,
        volume,
        scaleFilter
      });
    }

    // Concatenate all chunks into the final clip output
    await this.concatVideos(chunkPaths, outPath, true); // stream copy — same resolution chunks
  }

  // ── Concatenate video files ───────────────────────────────────────────────
  // useStreamCopy=true: skip re-encoding — 10-20x faster.
  // Used when all inputs share the same codec/resolution (e.g. chunks).
  // useStreamCopy=false (default): re-encode, for clips with different sources.
  concatVideos(files, outPath, useStreamCopy = false) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return reject(new Error("CANCELLED"));

      if (files.length === 1) {
        fs.copyFileSync(files[0], outPath);
        return resolve(outPath);
      }

      const listFile = path.join(this.tempDir, "concat_" + Date.now() + ".txt");
      fs.writeFileSync(
        listFile,
        files.map(f => "file '" + f.replace(/'/g,"'\\''") + "'").join("\n")
      );

      const outputOpts = useStreamCopy
        ? ["-c", "copy"]
        : ["-c:v","libx264","-preset","ultrafast","-crf","28","-c:a","aac","-ar","44100","-ac","2"];

      const cmd = ffmpeg()
        .input(listFile)
        .inputOptions(["-f","concat","-safe","0"])
        .outputOptions(outputOpts)
        .output(outPath);

      this.currentCmd = cmd;
      cmd
        .on("start", c => console.log("  [concat:" + (useStreamCopy ? "copy" : "encode") + "] " + c.slice(0,120)))
        .on("end", () => {
          this.currentCmd = null;
          try { fs.unlinkSync(listFile); } catch (_) {}
          resolve(outPath);
        })
        .on("error", err => {
          this.currentCmd = null;
          try { fs.unlinkSync(listFile); } catch (_) {}
          if (this.cancelled) return reject(new Error("CANCELLED"));
          reject(new Error("concat: " + err.message));
        })
        .run();
    });
  }

  // ── Probe for audio stream ────────────────────────────────────────────────
  hasAudioStream(filePath) {
    return new Promise(resolve => {
      ffmpeg.ffprobe(filePath, (err, meta) => {
        if (err) return resolve(false);
        resolve(meta.streams?.some(s => s.codec_type === "audio") ?? false);
      });
    });
  }

  // ── Run ffmpeg command as promise ─────────────────────────────────────────
  _run(cmd) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return reject(new Error("CANCELLED"));
      this.currentCmd = cmd;
      cmd
        .on("start", c => console.log("  [ffmpeg] " + c.slice(0,120)))
        .on("end",   () => { this.currentCmd = null; console.log("  ✓ done"); resolve(); })
        .on("error", err => {
          this.currentCmd = null;
          if (this.cancelled) return reject(new Error("CANCELLED"));
          console.error("  ✗", err.message);
          reject(err);
        })
        .run();
    });
  }

  // ── Mix external audio into video ─────────────────────────────────────────
  async mixAudio(videoPath, audioItems, outPath, duration) {
    if (this.cancelled) throw new Error("CANCELLED");

    const videoHasAudio = await this.hasAudioStream(videoPath);
    const cmd = ffmpeg(videoPath);
    audioItems.forEach(a => cmd.input(a.path));

    const filterParts = [], labels = [];

    if (videoHasAudio) {
      filterParts.push(
        "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[v0a]"
      );
      labels.push("[v0a]");
    }

    audioItems.forEach((a, i) => {
      const delayMs = Math.round((a.start || 0) * 1000);
      filterParts.push(
        "[" + (i+1) + ":a]" +
        "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo," +
        "adelay=" + delayMs + "|" + delayMs + "[ext" + i + "a]"
      );
      labels.push("[ext" + i + "a]");
    });

    if (labels.length === 0) {
      await this._run(ffmpeg(videoPath).outputOptions(["-c","copy"]).output(outPath));
      return;
    }

    filterParts.push(
      labels.join("") +
      "amix=inputs=" + labels.length +
      ":duration=longest:dropout_transition=2:normalize=0[aout]"
    );

    cmd
      .complexFilter(filterParts.join(";"))
      .outputOptions([
        "-t", String(duration),
        "-map","0:v","-map","[aout]",
        "-c:v","libx264","-preset","ultrafast","-crf","28",
        "-c:a","aac","-pix_fmt","yuv420p",
        "-ar","44100","-ac","2",
        "-movflags","+faststart"
      ])
      .output(outPath);

    await this._run(cmd);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAIN PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  async processTimeline({ tracks, projectName, ratio = '16:9' }) {
    this.reset();
    this.ensureDirs();

    const videoTrack = tracks.find(t => t.type === "video");
    const audioTrack = tracks.find(t => t.type === "audio");
    const textTrack  = tracks.find(t => t.type === "text");

    if (!videoTrack?.clips?.length) throw new Error("No video clips");

    const endTime = Math.max(...tracks.flatMap(t => t.clips.map(c => c.end)));
    const outPath = path.join(this.outputsDir, projectName + ".mp4");
    const cleanup = [];

    // ── OPTION 3: Pick resolution based on total duration ──────────────────
    const { scale: scaleFilter, width: resW, height: resH } = getScaleFilter(endTime, ratio);

    console.log("\n🎬 Exporting: " + projectName);
    console.log(`  Total duration: ${endTime.toFixed(1)}s`);
    tracks.forEach(t => console.log("  " + t.type + ": " + (t.clips?.length || 0) + " clips"));

    // ── STEP 1: Render clips (with chunking for long clips) ────────────────
    console.log("\n📽  Rendering clips…");
    const sorted   = [...videoTrack.clips].sort((a,b) => a.start - b.start);
    const rendered = [];

    for (let i = 0; i < sorted.length; i++) {
      if (this.cancelled) throw new Error("CANCELLED");
      const clip = sorted[i];
      const p    = path.join(this.tempDir, "clip_" + i + "_" + Date.now() + ".mp4");
      cleanup.push(p);
      const clipDur = (clip.end - clip.start).toFixed(1);
      console.log(
        `  [${i+1}/${sorted.length}] "${clip.name}" ${clipDur}s muted=${!!clip.muted} vol=${clip.volume ?? 1}`
      );
      try {
        // OPTION 2: automatically chunks long clips
        await this.processVideoClipChunked(clip, p, scaleFilter, cleanup);
        rendered.push(p);
      } catch (e) {
        if (e.message === "CANCELLED") throw e;
        console.error("  ⚠️  Skipped: " + e.message);
      }
    }

    if (!rendered.length) throw new Error("None of the video clips could be processed");

    // ── STEP 2: Concatenate rendered clips ────────────────────────────────
    if (this.cancelled) throw new Error("CANCELLED");
    console.log("\n🔗 Concatenating…");
    const concatPath = path.join(this.tempDir, "concat_" + Date.now() + ".mp4");
    cleanup.push(concatPath);
    await this.concatVideos(rendered, concatPath, true); // stream copy — all clips same res

    // ── STEP 3: Burn subtitles ─────────────────────────────────────────────
    let baseVideo = concatPath;

    if (textTrack?.clips?.length) {
      if (this.cancelled) throw new Error("CANCELLED");
      const assPath = path.join(this.tempDir, "subs_" + Date.now() + ".ass");
      cleanup.push(assPath);
      // Pass actual resolution so subtitle positions scale correctly
      const written = this.buildAssFile(textTrack.clips, assPath, resW, resH);

      if (written) {
        console.log("\n📝 Burning subtitles…");
        const subbedPath = path.join(this.tempDir, "subbed_" + Date.now() + ".mp4");
        cleanup.push(subbedPath);
        const escapedAss = assPath.replace(/\\/g,"/").replace(/:/g,"\\:");

        await this._run(
          ffmpeg(baseVideo)
            .outputOptions([
              "-t", String(endTime),
              "-vf", "subtitles='" + escapedAss + "'",
              "-c:v","libx264","-preset","ultrafast","-crf","28",
              "-c:a","aac","-pix_fmt","yuv420p"
            ])
            .output(subbedPath)
        );
        baseVideo = subbedPath;
      }
    }

    // ── STEP 4: Mix audio ──────────────────────────────────────────────────
    if (audioTrack?.clips?.length) {
      if (this.cancelled) throw new Error("CANCELLED");
      console.log("\n🎵 Processing audio…");
      const audioItems = [];

      for (let i = 0; i < audioTrack.clips.length; i++) {
        if (this.cancelled) throw new Error("CANCELLED");
        const clip   = audioTrack.clips[i];
        const lp     = this.resolveFilePath(clip);
        if (!lp) { console.warn("  ⚠️  Audio not found: " + clip.name); continue; }

        const volume   = clip.muted ? 0 : (clip.volume ?? 1.0);
        const duration = clip.end - clip.start;
        const offset   = clip.mediaOffset || 0;
        const ap       = path.join(this.tempDir, "audio_" + i + "_" + Date.now() + ".aac");
        cleanup.push(ap);

        try {
          await this._run(
            ffmpeg(lp)
              .inputOptions(["-ss", String(offset)])
              .audioFilters("volume=" + volume)
              .outputOptions(["-t", String(duration), "-c:a","aac","-ar","44100","-ac","2","-vn"])
              .output(ap)
          );
          audioItems.push({ path: ap, start: clip.start });
          console.log('  ✓ "' + clip.name + '" vol=' + volume);
        } catch (e) {
          if (e.message === "CANCELLED") throw e;
          console.error('  ⚠️  Audio "' + clip.name + '": ' + e.message);
        }
      }

      if (audioItems.length > 0) {
        await this.mixAudio(baseVideo, audioItems, outPath, endTime);
      } else {
        fs.copyFileSync(baseVideo, outPath);
      }
    } else {
      if (this.cancelled) throw new Error("CANCELLED");
      await this._run(
        ffmpeg(baseVideo)
          .outputOptions([
            "-t", String(endTime),
            "-c:v","libx264","-preset","ultrafast","-crf","28",
            "-c:a","aac","-pix_fmt","yuv420p",
            "-movflags","+faststart"
          ])
          .output(outPath)
      );
    }

    // ── Cleanup temp files ─────────────────────────────────────────────────
    cleanup.forEach(p => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    });

    console.log("\n✅ Exported: " + outPath);
    return outPath;
  }
}

export default VideoProcessor;