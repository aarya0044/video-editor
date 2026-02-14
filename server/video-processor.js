import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

class VideoProcessor {
  constructor() {
    this.tempDir    = path.join(__dirname, 'temp');
    this.outputsDir = path.join(__dirname, 'outputs');
    this.uploadsDir = path.join(__dirname, 'uploads');
    this.audioDir   = path.join(__dirname, 'public', 'audio');
    this.ensureDirs();
  }

  ensureDirs() {
    [this.tempDir, this.outputsDir, this.uploadsDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  // ── Resolve clip src → absolute local path ──────────────────────────────
  resolveFilePath(clip) {
    const raw = clip.src || clip.url || '';

    const uIdx = raw.indexOf('/uploads/');
    if (uIdx !== -1) {
      const filename = decodeURIComponent(raw.slice(uIdx + '/uploads/'.length));
      const full = path.join(this.uploadsDir, filename);
      if (fs.existsSync(full)) return full;
      // fuzzy match — multer may add timestamp
      const ext   = path.extname(filename).toLowerCase();
      const base  = path.basename(filename, ext);
      const match = fs.readdirSync(this.uploadsDir).find(f =>
        path.extname(f).toLowerCase() === ext &&
        (f === filename || path.basename(f, path.extname(f)).startsWith(base) || base.startsWith(path.basename(f, path.extname(f))))
      );
      if (match) return path.join(this.uploadsDir, match);
    }

    const aIdx = raw.indexOf('/audio/');
    if (aIdx !== -1) {
      const filename = decodeURIComponent(raw.slice(aIdx + '/audio/'.length));
      const full = path.join(this.audioDir, filename);
      if (fs.existsSync(full)) return full;
    }

    if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
    return null;
  }

  // ── Escape text for -vf drawtext ─────────────────────────────────────────
  // Rules for -vf (NOT filter_complex — different escaping):
  //   backslash → \\   apostrophe → \'   colon → \:
  escapeForVf(text) {
  return String(text)
    .replace(/\\/g, '\\\\')   // backslash
    .replace(/:/g, '\\:')     // colon
    .replace(/'/g, "\\'")     // single quote
    .replace(/,/g, '\\,')     // comma
    .replace(/\n/g, ' ')      // newlines
    .replace(/\r/g, ' ');
}



  // ── Build drawtext filter string (for use with -vf only) ─────────────────
  buildDrawtext(clip, startSec, endSec) {
  const ov = clip.textOverlay;
  if (!ov?.enabled || !ov.text?.trim()) return null;

  const text = this.escapeForVf(ov.text.trim());

  const fontSize  = Math.max(8, parseInt(ov.fontSize) || 32);
  const fontColor = (ov.fontColor || '#ffffff').replace(/^#/, '0x');

  let x, y;
  if (ov.position === 'custom' && ov.px != null && ov.py != null) {
    x = `(w*${(ov.px / 100).toFixed(4)}-text_w/2)`;
    y = `(h*${(ov.py / 100).toFixed(4)}-text_h/2)`;
  } else {
    switch (ov.position) {
      case 'top-left':     x = '20';            y = '20';            break;
      case 'top-right':    x = 'w-text_w-20';   y = '20';            break;
      case 'bottom-left':  x = '20';            y = 'h-text_h-20';   break;
      case 'bottom-right': x = 'w-text_w-20';   y = 'h-text_h-20';   break;
      default:             x = '(w-text_w)/2';  y = '(h-text_h)/2';  break;
    }
  }

  const enable =
    startSec != null && endSec != null
      ? `:enable=between(t\\,${startSec}\\,${endSec})`
      : '';

  return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}` +
         `:x=${x}:y=${y}:box=1:boxcolor=black@0.5:boxborderw=8${enable}`;
}

  // ── Render one video/image clip → normalised 1280×720 MP4 ────────────────
  processVideoClip(clip, outputPath) {
    return new Promise((resolve, reject) => {
      const localPath = this.resolveFilePath(clip);
      if (!localPath) return reject(new Error(`File not found: "${clip.name}" (${clip.src})`));

      const duration = clip.end - clip.start;
      if (duration <= 0.01) return reject(new Error(`Zero duration: "${clip.name}"`));

      const isImage = clip.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(localPath);
      const isMuted = clip.muted === true;

      const SCALE = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';

      let cmd = ffmpeg();

      if (isImage) {
  cmd
    .input(localPath)
    .inputOptions(['-loop', '1', '-framerate', '30'])
    .input('anullsrc=r=44100:cl=stereo')
    .inputOptions(['-f', 'lavfi'])
    .outputOptions([
      '-t', String(duration),
      '-vf', SCALE,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-ar', '44100',
      '-ac', '2',
      '-shortest'
    ]);
      } else if (isMuted) {
        // Muted video: strip audio track entirely
        cmd.input(localPath).inputOptions(['-ss', String(clip.trimStart || 0)])
          .outputOptions([
            '-t', String(duration), '-vf', SCALE,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-an'
          ]);
      } else {
        cmd.input(localPath).inputOptions(['-ss', String(clip.trimStart || 0)])
          .outputOptions([
            '-t', String(duration), '-vf', SCALE,
            '-c:v', 'libx264', '-c:a', 'aac',
            '-pix_fmt', 'yuv420p', '-r', '30', '-ar', '44100', '-ac', '2'
          ]);
      }

      cmd.output(outputPath)
        .on('start', c => console.log(`  [clip] ${c.slice(0, 140)}`))
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(new Error(`clip: ${err.message}`)))
        .run();
    });
  }

  // ── Add silent audio to video-only mp4 ───────────────────────────────────
  addSilentAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .input('anullsrc=r=44100:cl=stereo').inputOptions(['-f', 'lavfi'])
        .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest', '-ar', '44100', '-ac', '2'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject).run();
    });
  }

  // ── Probe for audio stream ────────────────────────────────────────────────
  hasAudioStream(filePath) {
    return new Promise(resolve => {
      ffmpeg.ffprobe(filePath, (err, meta) => {
        if (err) return resolve(false);
        resolve(meta.streams?.some(s => s.codec_type === 'audio') ?? false);
      });
    });
  }

  // ── Concatenate clips ─────────────────────────────────────────────────────
  // ── Concatenate clips using concat demuxer (stream copy) ─────────────────
concatDemuxer(inputPaths, outputPath) {
  return new Promise((resolve, reject) => {
    if (inputPaths.length === 1) {
      fs.copyFileSync(inputPaths[0], outputPath);
      return resolve(outputPath);
    }

    // Create a temporary file list
    const listPath = path.join(this.tempDir, `concat-${Date.now()}.txt`);
    const listContent = inputPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])   // stream copy, no re-encoding
      .output(outputPath)
      .on('start', c => console.log(`  [concat] ${c.slice(0, 140)}`))
      .on('end', () => {
        try { fs.unlinkSync(listPath); } catch {}
        resolve(outputPath);
      })
      .on('error', err => {
        try { fs.unlinkSync(listPath); } catch {}
        reject(new Error(`concat demuxer: ${err.message}`));
      })
      .run();
  });
}

  // ── Run ffmpeg command as promise ─────────────────────────────────────────
  _run(cmd) {
    return new Promise((resolve, reject) => {
      cmd
        .on('start', c => console.log(`  [ffmpeg] ${c.slice(0, 140)}`))
        .on('end',   () => { console.log('  ✓ done'); resolve(); })
        .on('error', err => { console.error('  ✗', err.message); reject(err); })
        .run();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAIN EXPORT PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  async processTimeline({ tracks, projectName }) {
    this.ensureDirs();
    const outputPath = path.join(this.outputsDir, `${projectName}.mp4`);
    const cleanup    = [];

    console.log(`\n🎬 Exporting: ${projectName}`);
    tracks.forEach(t => console.log(`  ${t.type}: ${t.clips?.length || 0} clips`));

    const videoTrack = tracks.find(t => t.type === 'video');
    const audioTrack = tracks.find(t => t.type === 'audio');
    const textTrack  = tracks.find(t => t.type === 'text');

    if (!videoTrack?.clips?.length) throw new Error('No video clips in timeline');

    // ── STEP 1: Render each video/image clip ────────────────────────────────
    console.log('\n📽  Rendering clips…');
    const sorted        = [...videoTrack.clips].sort((a, b) => a.start - b.start);
    const renderedPaths = [];

    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i];
      const p    = path.join(this.tempDir, `clip${i}_${Date.now()}.mp4`);
      cleanup.push(p);
      console.log(`  [${i+1}/${sorted.length}] "${clip.name}" muted=${!!clip.muted}`);
      try {
        await this.processVideoClip(clip, p);
        renderedPaths.push(p);
      } catch (e) {
        console.error(`  ⚠️  Skipped: ${e.message}`);
      }
    }
    if (!renderedPaths.length) throw new Error('None of the video clips could be processed');

    // ── STEP 2: Normalise — every clip must have (or not have) audio ────────
    console.log('\n🔊 Normalising audio streams…');
    const checks      = await Promise.all(renderedPaths.map(p => this.hasAudioStream(p)));
    const anyHasAudio = checks.some(Boolean);
    let readyPaths    = renderedPaths;

    if (anyHasAudio) {
      readyPaths = [];
      for (let i = 0; i < renderedPaths.length; i++) {
        if (!checks[i]) {
          const p2 = path.join(this.tempDir, `clip${i}_sa_${Date.now()}.mp4`);
          cleanup.push(p2);
          await this.addSilentAudio(renderedPaths[i], p2);
          readyPaths.push(p2);
        } else {
          readyPaths.push(renderedPaths[i]);
        }
      }
    }

    // ── STEP 3: Concatenate ─────────────────────────────────────────────────
    console.log('\n🔗 Concatenating…');
    const concatPath = path.join(this.tempDir, `concat_${Date.now()}.mp4`);
    cleanup.push(concatPath);
    await this.concatDemuxer(readyPaths, concatPath);

    // ── STEP 4: Process external audio track ───────────────────────────────
    console.log('\n🎵 Processing audio track…');
    const extAudio = [];
    if (audioTrack?.clips?.length) {
      for (const [i, clip] of audioTrack.clips.entries()) {
        const lp = this.resolveFilePath(clip);
        if (!lp) { console.warn(`  ⚠️  Audio not found: "${clip.name}"`); continue; }
        const ap = path.join(this.tempDir, `ext_audio${i}_${Date.now()}.aac`);
        cleanup.push(ap);
        try {
          await this._run(
            ffmpeg(lp)
              .outputOptions(['-t', String(clip.end - clip.start), '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-vn'])
              .output(ap)
          );
          extAudio.push(ap);
          console.log(`  ✓ "${clip.name}"`);
        } catch (e) {
          console.error(`  ⚠️  Audio "${clip.name}": ${e.message}`);
        }
      }
    }

    // ── STEP 5: Build text overlay filters ─────────────────────────────────
    // CRITICAL: Use clip.start/end as timeline seconds for the enable expression.
    // These go into -vf, NOT filter_complex, so NO backslash-escaping of commas.
    const textFilters = [];
    if (textTrack?.clips?.length) {
      for (const clip of textTrack.clips) {
        const dt = this.buildDrawtext(clip, clip.start, clip.end);
        if (dt) {
          console.log(`  Text: "${clip.textOverlay?.text}" @ ${clip.start}s–${clip.end}s`);
          textFilters.push(dt);
        }
      }
    }

    // ── STEP 6: Final composition ───────────────────────────────────────────
    console.log('\n✂️  Final composition…');
    console.log(`  hasText=${textFilters.length > 0}, hasExtAudio=${extAudio.length > 0}`);

    const hasText = textFilters.length > 0;
    const hasExt  = extAudio.length > 0;

    // ── A: Video only — just re-encode cleanly ──────────────────────────────
    if (!hasText && !hasExt) {
      await this._run(
        ffmpeg(concatPath)
          .outputOptions(['-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
          .output(outputPath)
      );

    // ── B: Text only — -vf drawtext, no filter_complex ─────────────────────
    } else if (hasText && !hasExt) {
      const vfStr = textFilters.join(',');
      console.log(`  -vf: ${vfStr.slice(0, 120)}`);
      await this._run(
        ffmpeg(concatPath)
          .outputOptions([
            '-vf', vfStr,
            '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'
          ])
          .output(outputPath)
      );

    // ── C: External audio only — amix in filter_complex ────────────────────
    } else if (!hasText && hasExt) {
      await this._mixAudio(concatPath, extAudio, outputPath);

    // ── D: Both text AND external audio — two-pass ─────────────────────────
    } else {
      const midPath = path.join(this.tempDir, `textpass_${Date.now()}.mp4`);
      cleanup.push(midPath);

      // Pass 1: burn text with -vf
      const vfStr = textFilters.join(',');
      console.log(`  Pass1 -vf: ${vfStr.slice(0, 120)}`);
      await this._run(
        ffmpeg(concatPath)
          .outputOptions(['-vf', vfStr, '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p'])
          .output(midPath)
      );

      // Pass 2: mix audio
      await this._mixAudio(midPath, extAudio, outputPath);
    }

    // ── Cleanup temp files ──────────────────────────────────────────────────
    cleanup.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} });
    console.log(`\n✅ Exported: ${outputPath}`);
    return outputPath;
  }

  // ── Mix external audio files into a video source ─────────────────────────
  async _mixAudio(videoPath, extAudioPaths, outputPath) {
  const videoHasAudio = await this.hasAudioStream(videoPath);
  const n = extAudioPaths.length;

  let cmd = ffmpeg(videoPath);
  extAudioPaths.forEach(p => cmd.input(p));

  const filterParts = [];
  const audioInputLabels = [];

  // Convert video's audio (if present) to standard format
  if (videoHasAudio) {
    filterParts.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[0a]`);
    audioInputLabels.push('[0a]');
  }

  // Convert each external audio to standard format
  for (let i = 0; i < n; i++) {
    filterParts.push(`[${i + 1}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${i + 1}a]`);
    audioInputLabels.push(`[${i + 1}a]`);
  }

  // If no audio at all, just copy video (shouldn't happen)
  if (audioInputLabels.length === 0) {
    await this._run(
      ffmpeg(videoPath)
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
    );
    return;
  }

  // Build the amix filter
  const amixInputs = audioInputLabels.join('');
  const amixFilter = `${amixInputs}amix=inputs=${audioInputLabels.length}:duration=first:dropout_transition=2[aout]`;
  filterParts.push(amixFilter);

  const filterGraph = filterParts.join(';');

  cmd
    .complexFilter(filterGraph)
    .outputOptions([
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart'
    ])
    .output(outputPath);

  await this._run(cmd);
}
}

export default VideoProcessor;