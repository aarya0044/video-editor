import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Use system FFmpeg in Docker (has all filters). Fall back to ffmpeg-static locally.
const SYSTEM_FFMPEG  = '/usr/local/bin/ffmpeg';
const SYSTEM_FFPROBE = '/usr/local/bin/ffprobe';
if (fs.existsSync(SYSTEM_FFMPEG)) {
  ffmpeg.setFfmpegPath(SYSTEM_FFMPEG);
  ffmpeg.setFfprobePath(SYSTEM_FFPROBE);
} else if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

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
      const ext   = path.extname(filename).toLowerCase();
      const base  = path.basename(filename, ext);
      const match = fs.readdirSync(this.uploadsDir).find(f =>
        path.extname(f).toLowerCase() === ext &&
        (f === filename ||
          path.basename(f, path.extname(f)).startsWith(base) ||
          base.startsWith(path.basename(f, path.extname(f))))
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

  // ── Build an ASS subtitle file from text track clips ─────────────────────
  // Uses the ASS subtitles filter instead of drawtext (drawtext needs libfreetype
  // which is not available in standard Ubuntu apt FFmpeg builds).
  buildAssFile(textClips, outputPath) {
    const lines = [];

    lines.push('[Script Info]');
    lines.push('ScriptType: v4.00+');
    lines.push('PlayResX: 1280');
    lines.push('PlayResY: 720');
    lines.push('WrapStyle: 0');
    lines.push('');
    lines.push('[V4+ Styles]');
    lines.push(
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, ' +
      'OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ' +
      'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, ' +
      'Alignment, MarginL, MarginR, MarginV, Encoding'
    );

    const dialogueLines = [];

    for (const clip of textClips) {
      const ov = clip.textOverlay;
      if (!ov || !ov.enabled || !ov.text || !ov.text.trim()) continue;

      const fontSize = Math.max(8, parseInt(ov.fontSize) || 32);

      // Convert #rrggbb → ASS &H00BBGGRR
      const hex = (ov.fontColor || '#ffffff').replace('#', '').padEnd(6, '0');
      const r = hex.slice(0, 2);
      const g = hex.slice(2, 4);
      const b = hex.slice(4, 6);
      const primaryColour = ('&H00' + b + g + r).toUpperCase();

      // ASS alignment numbers:
      // 7=top-left  8=top-center  9=top-right
      // 4=mid-left  5=mid-center  6=mid-right
      // 1=bot-left  2=bot-center  3=bot-right
      let alignment = 5;
      switch (ov.position) {
        case 'top-left':     alignment = 7; break;
        case 'top-right':    alignment = 9; break;
        case 'bottom-left':  alignment = 1; break;
        case 'bottom-right': alignment = 3; break;
        default:             alignment = 5; break;
      }

      const styleName = 'S' + clip.id.replace(/[^a-zA-Z0-9]/g, '_');

      lines.push(
        'Style: ' + styleName + ',Arial,' + fontSize + ',' +
        primaryColour + ',&H000000FF,&H00000000,&H80000000,' +
        '0,0,0,0,100,100,0,0,1,2,1,' + alignment + ',10,10,10,1'
      );

      // Format seconds → H:MM:SS.cc  (ASS centiseconds)
      const fmtT = (s) => {
        const h  = Math.floor(s / 3600);
        const m  = Math.floor((s % 3600) / 60);
        const sc = s % 60;
        const cs = Math.floor((sc - Math.floor(sc)) * 100);
        return (
          h + ':' +
          String(m).padStart(2, '0') + ':' +
          String(Math.floor(sc)).padStart(2, '0') + '.' +
          String(cs).padStart(2, '0')
        );
      };

      // For custom positions use \pos(x,y) override tag
      // ASS coords: x=0..1280, y=0..720
      let posTag = '';
      if (ov.position === 'custom' && ov.px != null && ov.py != null) {
        const ax = Math.round(ov.px * 12.8);
        const ay = Math.round(ov.py * 7.2);
        posTag = '{\\pos(' + ax + ',' + ay + ')}';
      }

      const safeText = String(ov.text)
        .replace(/\r\n/g, '\\N')
        .replace(/\n/g, '\\N')
        .replace(/\r/g, '\\N');

      dialogueLines.push(
        'Dialogue: 0,' +
        fmtT(clip.start) + ',' +
        fmtT(clip.end) + ',' +
        styleName + ',,0,0,0,,' +
        posTag + safeText
      );
    }

    if (dialogueLines.length === 0) return false;

    lines.push('');
    lines.push('[Events]');
    lines.push(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    );
    dialogueLines.forEach(d => lines.push(d));

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
    return true;
  }

  // ── Render one video/image clip → normalised 1280×720 MP4 ────────────────
  // Always outputs BOTH video and audio streams.
  processVideoClip(clip, outputPath) {
    return new Promise((resolve, reject) => {
      const localPath = this.resolveFilePath(clip);
      if (!localPath) {
        return reject(new Error('File not found: "' + clip.name + '" (' + clip.src + ')'));
      }

      const duration = clip.end - clip.start;
      if (duration <= 0.01) {
        return reject(new Error('Zero duration: "' + clip.name + '"'));
      }

      const sourceStart = clip.mediaOffset || 0;
      const isImage = clip.type?.includes('image') ||
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(localPath);
      const isMuted = clip.muted === true;
      const volume  = clip.volume != null ? clip.volume : 1.0;

      const SCALE =
        'scale=1280:720:force_original_aspect_ratio=decrease,' +
        'pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';
      const INPUT_GENPTS  = ['-fflags', '+genpts'];
      const OUTPUT_TS_FIX = ['-avoid_negative_ts', 'make_zero'];

      let cmd = ffmpeg();

      if (isImage) {
        // Loop image + generate silence via aevalsrc (no lavfi format needed)
        cmd
          .input(localPath)
          .inputOptions(['-loop', '1', '-framerate', '30', ...INPUT_GENPTS])
          .complexFilter([
            '[0:v]' + SCALE + '[v]',
            'aevalsrc=0:channel_layout=stereo:sample_rate=44100[a]'
          ])
          .outputOptions([
            '-map', '[v]',
            '-map', '[a]',
            '-t', String(duration),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-ar', '44100',
            '-ac', '2',
            ...OUTPUT_TS_FIX
          ]);

      } else if (isMuted) {
        // Muted video: replace audio with silence
        cmd
          .input(localPath)
          .inputOptions(['-ss', String(sourceStart), ...INPUT_GENPTS])
          .complexFilter([
            '[0:v]' + SCALE + '[v]',
            'aevalsrc=0:channel_layout=stereo:sample_rate=44100[a]'
          ])
          .outputOptions([
            '-map', '[v]',
            '-map', '[a]',
            '-t', String(duration),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-ar', '44100',
            '-ac', '2',
            ...OUTPUT_TS_FIX
          ]);

      } else {
        // Normal video: keep audio, apply volume
        cmd
          .input(localPath)
          .inputOptions(['-ss', String(sourceStart), ...INPUT_GENPTS])
          .outputOptions([
            '-t', String(duration),
            '-vf', SCALE,
            '-af', 'volume=' + volume,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-ar', '44100',
            '-ac', '2',
            ...OUTPUT_TS_FIX
          ]);
      }

      cmd.output(outputPath)
        .on('start', c => console.log('  [clip] ' + c.slice(0, 140)))
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(new Error('clip: ' + err.message)))
        .run();
    });
  }

  // ── Add silent audio to a video-only file ────────────────────────────────
  addSilentAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(['aevalsrc=0:channel_layout=stereo:sample_rate=44100[a]'])
        .outputOptions([
          '-map', '0:v',
          '-map', '[a]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          '-ar', '44100',
          '-ac', '2'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
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

  // ── Concatenate clips using concat demuxer ────────────────────────────────
  concatDemuxer(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
      if (inputPaths.length === 1) {
        fs.copyFileSync(inputPaths[0], outputPath);
        return resolve(outputPath);
      }

      const listPath = path.join(this.tempDir, 'concat-' + Date.now() + '.txt');
      const listContent = inputPaths
        .map(p => "file '" + p.replace(/'/g, "'\\''") + "'")
        .join('\n');
      fs.writeFileSync(listPath, listContent);

      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c:v', 'libx264', '-c:a', 'aac'])
        .output(outputPath)
        .on('start', c => console.log('  [concat] ' + c.slice(0, 140)))
        .on('end', () => {
          try { fs.unlinkSync(listPath); } catch (_) {}
          resolve(outputPath);
        })
        .on('error', err => {
          try { fs.unlinkSync(listPath); } catch (_) {}
          reject(new Error('concat demuxer: ' + err.message));
        })
        .run();
    });
  }

  // ── Run an ffmpeg command as a promise ────────────────────────────────────
  _run(cmd) {
    return new Promise((resolve, reject) => {
      cmd
        .on('start', c => console.log('  [ffmpeg] ' + c.slice(0, 140)))
        .on('end', () => { console.log('  ✓ done'); resolve(); })
        .on('error', err => { console.error('  ✗', err.message); reject(err); })
        .run();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAIN EXPORT PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  async processTimeline({ tracks, projectName }) {
    this.ensureDirs();

    const timelineEnd = Math.max(
      ...tracks.flatMap(t => t.clips.map(c => c.end))
    );

    const outputPath = path.join(this.outputsDir, projectName + '.mp4');
    const cleanup    = [];

    console.log('\n🎬 Exporting: ' + projectName);
    tracks.forEach(t => console.log('  ' + t.type + ': ' + (t.clips?.length || 0) + ' clips'));

    const videoTrack = tracks.find(t => t.type === 'video');
    const audioTrack = tracks.find(t => t.type === 'audio');
    const textTrack  = tracks.find(t => t.type === 'text');

    if (!videoTrack?.clips?.length) throw new Error('No video clips in timeline');

    // ── STEP 1: Render each video/image clip ─────────────────────────────
    console.log('\n📽  Rendering clips…');
    const sorted        = [...videoTrack.clips].sort((a, b) => a.start - b.start);
    const renderedPaths = [];

    for (let i = 0; i < sorted.length; i++) {
      const clip = sorted[i];
      const p    = path.join(this.tempDir, 'clip' + i + '_' + Date.now() + '.mp4');
      cleanup.push(p);
      console.log(
        '  [' + (i + 1) + '/' + sorted.length + '] "' +
        clip.name + '" muted=' + !!clip.muted +
        ' volume=' + (clip.volume ?? 1)
      );
      try {
        await this.processVideoClip(clip, p);
        renderedPaths.push(p);
      } catch (e) {
        console.error('  ⚠️  Skipped: ' + e.message);
      }
    }

    if (!renderedPaths.length) throw new Error('None of the video clips could be processed');

    // ── STEP 2: Concatenate ───────────────────────────────────────────────
    console.log('\n🔗 Concatenating…');
    const concatPath = path.join(this.tempDir, 'concat_' + Date.now() + '.mp4');
    cleanup.push(concatPath);
    await this.concatDemuxer(renderedPaths, concatPath);

    // ── STEP 3: Process external audio track ─────────────────────────────
    console.log('\n🎵 Processing audio track…');
    const extAudio = [];

    if (audioTrack?.clips?.length) {
      for (let i = 0; i < audioTrack.clips.length; i++) {
        const clip = audioTrack.clips[i];
        const lp   = this.resolveFilePath(clip);
        if (!lp) { console.warn('  ⚠️  Audio not found: "' + clip.name + '"'); continue; }

        const sourceStart = clip.mediaOffset || 0;
        const duration    = clip.end - clip.start;
        const volume      = clip.muted ? 0 : (clip.volume ?? 1.0);
        const ap = path.join(this.tempDir, 'ext_audio' + i + '_' + Date.now() + '.aac');
        cleanup.push(ap);

        try {
          await this._run(
            ffmpeg(lp)
              .inputOptions(['-ss', String(sourceStart)])
              .audioFilters('volume=' + volume)
              .outputOptions([
                '-t', String(duration),
                '-c:a', 'aac',
                '-ar', '44100',
                '-ac', '2',
                '-vn'
              ])
              .output(ap)
          );
          extAudio.push({ path: ap, start: clip.start, end: clip.end });
          console.log('  ✓ "' + clip.name + '" vol=' + volume);
        } catch (e) {
          console.error('  ⚠️  Audio "' + clip.name + '": ' + e.message);
        }
      }
    }

    // ── STEP 4: Build ASS subtitle file ──────────────────────────────────
    // Uses subtitles filter (libass) instead of drawtext (libfreetype not in apt FFmpeg)
    let assPath = null;
    if (textTrack?.clips?.length) {
      const ap = path.join(this.tempDir, 'subs_' + Date.now() + '.ass');
      const written = this.buildAssFile(textTrack.clips, ap);
      if (written) {
        assPath = ap;
        cleanup.push(ap);
        console.log('\n📝 ASS subtitle file: ' + ap);
        textTrack.clips.forEach(c => {
          if (c.textOverlay?.text) {
            console.log(
              '  Text: "' + c.textOverlay.text +
              '" @ ' + c.start + 's–' + c.end + 's'
            );
          }
        });
      }
    }

    // ── STEP 5: Final composition ─────────────────────────────────────────
    console.log('\n✂️  Final composition…');
    const hasText = !!assPath;
    const hasExt  = extAudio.length > 0;
    console.log('  hasText=' + hasText + ', hasExtAudio=' + hasExt);

    // Escape ASS path for ffmpeg filter string (forward slashes, escape colons)
    const escAss = p => p.replace(/\\/g, '/').replace(/:/g, '\\:');

    if (!hasText && !hasExt) {
      // A: Video only
      await this._run(
        ffmpeg(concatPath)
          .outputOptions([
            '-t', String(timelineEnd),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
          ])
          .output(outputPath)
      );

    } else if (hasText && !hasExt) {
      // B: Text only — burn subtitles
      console.log('  Burning subtitles: ' + assPath);
      await this._run(
        ffmpeg(concatPath)
          .outputOptions([
            '-t', String(timelineEnd),
            '-vf', "subtitles='" + escAss(assPath) + "'",
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
          ])
          .output(outputPath)
      );

    } else if (!hasText && hasExt) {
      // C: External audio only
      await this._mixAudio(concatPath, extAudio, outputPath, timelineEnd);

    } else {
      // D: Text + external audio — two passes
      const midPath = path.join(this.tempDir, 'textpass_' + Date.now() + '.mp4');
      cleanup.push(midPath);

      console.log('  Pass 1: burning subtitles');
      await this._run(
        ffmpeg(concatPath)
          .outputOptions([
            '-t', String(timelineEnd),
            '-vf', "subtitles='" + escAss(assPath) + "'",
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p'
          ])
          .output(midPath)
      );

      console.log('  Pass 2: mixing audio');
      await this._mixAudio(midPath, extAudio, outputPath, timelineEnd);
    }

    // ── Cleanup temp files ────────────────────────────────────────────────
    cleanup.forEach(p => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    });

    console.log('\n✅ Exported: ' + outputPath);
    return outputPath;
  }

  // ── Mix external audio clips into a video file ────────────────────────────
  async _mixAudio(videoPath, extAudioItems, outputPath, timelineEnd) {
    const videoHasAudio = await this.hasAudioStream(videoPath);
    const n = extAudioItems.length;

    const cmd = ffmpeg(videoPath);
    extAudioItems.forEach(item => cmd.input(item.path));

    const filterParts      = [];
    const audioInputLabels = [];

    if (videoHasAudio) {
      filterParts.push(
        '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[0a]'
      );
      audioInputLabels.push('[0a]');
    }

    for (let i = 0; i < n; i++) {
      const delayMs = Math.round(extAudioItems[i].start * 1000);
      filterParts.push(
        '[' + (i + 1) + ':a]' +
        'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,' +
        'adelay=' + delayMs + '|' + delayMs +
        '[' + (i + 1) + 'a]'
      );
      audioInputLabels.push('[' + (i + 1) + 'a]');
    }

    if (audioInputLabels.length === 0) {
      await this._run(ffmpeg(videoPath).outputOptions(['-c', 'copy']).output(outputPath));
      return;
    }

    const amixInputs = audioInputLabels.join('');
    filterParts.push(
      amixInputs +
      'amix=inputs=' + audioInputLabels.length +
      ':duration=longest:dropout_transition=2:normalize=0[aout]'
    );

    cmd
      .complexFilter(filterParts.join(';'))
      .outputOptions([
        '-t', String(timelineEnd),
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