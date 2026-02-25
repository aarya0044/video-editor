import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer system ffmpeg (Docker / Koyeb), fallback to ffmpeg-static (local)
ffmpeg.setFfmpegPath(
  fs.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : ffmpegStatic
);

class VideoProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, "temp");
    this.outputsDir = path.join(__dirname, "outputs");
    this.uploadsDir = path.join(__dirname, "uploads");
    this.audioDir = path.join(__dirname, "public", "audio");
    this.ensureDirs();
  }

  ensureDirs() {
    [this.tempDir, this.outputsDir, this.uploadsDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  // ─────────────────────────────────────────────
  // Resolve clip path
  // ─────────────────────────────────────────────
  resolveFilePath(clip) {
    const raw = clip.src || clip.url || "";

    if (raw.includes("/uploads/")) {
      const file = decodeURIComponent(raw.split("/uploads/")[1]);
      const full = path.join(this.uploadsDir, file);
      if (fs.existsSync(full)) return full;
    }

    if (raw.includes("/audio/")) {
      const file = decodeURIComponent(raw.split("/audio/")[1]);
      const full = path.join(this.audioDir, file);
      if (fs.existsSync(full)) return full;
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // Build ASS subtitle file
  // ─────────────────────────────────────────────
  buildAssFile(textClips, outPath) {
    const lines = [
      "[Script Info]",
      "ScriptType: v4.00+",
      "PlayResX: 1280",
      "PlayResY: 720",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
    ];

    const events = [];

    for (const c of textClips) {
      const t = c.textOverlay;
      if (!t?.enabled || !t.text?.trim()) continue;

      const start = this._fmtTime(c.start);
      const end = this._fmtTime(c.end);

      lines.push(
        `Style: S${c.id},Arial,${t.fontSize || 32},&H00FFFFFF,&H00000000,&H80000000,0,0,1,2,1,5,10,10,10,1`
      );

      events.push(
        `Dialogue: 0,${start},${end},S${c.id},,0,0,0,,${t.text.replace(/\n/g, "\\N")}`
      );
    }

    if (!events.length) return null;

    lines.push("", "[Events]");
    lines.push(
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    );
    events.forEach(e => lines.push(e));

    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    return outPath;
  }

  _fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = (sec % 60).toFixed(2);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(5, "0")}`;
  }

  // ─────────────────────────────────────────────
  // Render video/image clip → VIDEO ONLY
  // ─────────────────────────────────────────────
  processVideoClip(clip, outPath) {
    return new Promise((resolve, reject) => {
      const input = this.resolveFilePath(clip);
      if (!input) return reject(new Error("File not found"));

      const duration = clip.end - clip.start;
      const start = clip.mediaOffset || 0;
      const isImage = clip.type?.includes("image");

      const cmd = ffmpeg(input)
        .inputOptions(isImage ? ["-loop", "1"] : ["-ss", String(start)])
        .outputOptions([
          "-t", String(duration),
          "-vf",
          "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-an"
        ])
        .output(outPath)
        .on("end", () => resolve(outPath))
        .on("error", reject);

      cmd.run();
    });
  }

  // ─────────────────────────────────────────────
  // Concatenate video clips
  // ─────────────────────────────────────────────
  concatVideos(files, outPath) {
    const listFile = path.join(this.tempDir, `concat_${Date.now()}.txt`);
    fs.writeFileSync(
      listFile,
      files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join("\n")
    );

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "23",
          "-an"
        ])
        .output(outPath)
        .on("end", () => resolve(outPath))
        .on("error", reject)
        .run();
    });
  }

  // ─────────────────────────────────────────────
  // Mix external audio
  // ─────────────────────────────────────────────
  async mixAudio(videoPath, audioClips, outPath, duration) {
    const cmd = ffmpeg(videoPath);

    audioClips.forEach(a => cmd.input(a.path));

    const filters = audioClips.map((a, i) =>
      `[${i + 1}:a]adelay=${a.start * 1000}|${a.start * 1000}[a${i}]`
    );

    const mix = audioClips.map((_, i) => `[a${i}]`).join("");

    cmd
      .complexFilter([...filters, `${mix}amix=inputs=${audioClips.length}[aout]`])
      .outputOptions([
        "-t", String(duration),
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-movflags", "+faststart"
      ])
      .output(outPath);

    await this._run(cmd);
  }

  _run(cmd) {
    return new Promise((res, rej) => {
      cmd.on("end", res).on("error", rej).run();
    });
  }

  // ─────────────────────────────────────────────
  // MAIN PIPELINE
  // ─────────────────────────────────────────────
  async processTimeline({ tracks, projectName }) {
    const videoTrack = tracks.find(t => t.type === "video");
    const audioTrack = tracks.find(t => t.type === "audio");
    const textTrack = tracks.find(t => t.type === "text");

    if (!videoTrack?.clips?.length) throw new Error("No video clips");

    const endTime = Math.max(...videoTrack.clips.map(c => c.end));
    const rendered = [];

    for (let i = 0; i < videoTrack.clips.length; i++) {
      const p = path.join(this.tempDir, `clip_${i}.mp4`);
      await this.processVideoClip(videoTrack.clips[i], p);
      rendered.push(p);
    }

    const concatPath = path.join(this.tempDir, "video.mp4");
    await this.concatVideos(rendered, concatPath);

    let baseVideo = concatPath;

    if (textTrack?.clips?.length) {
      const ass = path.join(this.tempDir, "subs.ass");
      this.buildAssFile(textTrack.clips, ass);

      const subbed = path.join(this.tempDir, "subbed.mp4");
      await this._run(
        ffmpeg(baseVideo)
          .outputOptions([
            "-vf", `subtitles='${ass.replace(/\\/g, "/")}'`,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-an"
          ])
          .output(subbed)
      );
      baseVideo = subbed;
    }

    const out = path.join(this.outputsDir, `${projectName}.mp4`);

    if (audioTrack?.clips?.length) {
      const audios = audioTrack.clips.map(c => ({
        path: this.resolveFilePath(c),
        start: c.start
      }));
      await this.mixAudio(baseVideo, audios, out, endTime);
    } else {
      fs.copyFileSync(baseVideo, out);
    }

    return out;
  }
}

export default VideoProcessor;