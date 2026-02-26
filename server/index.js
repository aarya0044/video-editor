import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import VideoProcessor from './video-processor.js';
import { tasks } from "./tasks.js";
import { v4 as uuid } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  `http://localhost:${PORT}`;

const videoProcessor = new VideoProcessor();

// ── EXPORT LOCK — prevents multiple simultaneous FFmpeg jobs ──────────────────
let exportInProgress = false;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://video-editor-ten-lyart.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.error("❌ Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.options("*", cors());

// ── MULTER ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname).name;
    const extension = path.extname(file.originalname);
    cb(null, `${originalName}-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|wmv|flv|mkv|webm|jpg|jpeg|png|gif|mp3|wav|aac|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error('Only video, image and audio files are allowed'));
  },
  limits: { fileSize: 200 * 1024 * 1024 }
});

// ── UPLOAD ────────────────────────────────────────────────────────────────────
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    console.log('📁 Files received:', req.files?.length || 0);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    const files = req.files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.originalname,
      path: `/uploads/${file.filename}`,
      type: file.mimetype,
      size: file.size,
      url: `${BASE_URL}/uploads/${file.filename}`
    }));
    console.log('✅ Files processed:', files.map(f => f.url));
    res.json({ success: true, message: `Uploaded ${files.length} file(s)!`, files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    exportInProgress,
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    baseUrl: BASE_URL
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: '✅ EditFlow Server is running!',
    time: new Date().toLocaleString(),
    environment: isProduction ? 'production' : 'development',
    baseUrl: BASE_URL
  });
});

// ── LIST / DEBUG FILES ────────────────────────────────────────────────────────
app.get('/api/list-files', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const outputsDir = path.join(__dirname, 'outputs');
    const uploads = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    const outputs = fs.existsSync(outputsDir) ? fs.readdirSync(outputsDir) : [];
    res.json({ uploads, outputs, uploadsCount: uploads.length, outputsCount: outputs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug-uploads', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, count: 0, files: [], message: 'Uploads directory is empty' });
    }
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      return { name: filename, size: stats.size, type: path.extname(filename), url: `${BASE_URL}/uploads/${filename}` };
    });
    res.json({ success: true, count: files.length, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── EXPORT VIDEO ──────────────────────────────────────────────────────────────
app.post('/api/export-video', express.json(), (req, res) => {
  console.log('🎬 Received async export request');

  // LOCK: reject if another export is already running
  if (exportInProgress) {
    console.warn('⚠️  Export already in progress — rejected');
    return res.status(429).json({
      error: 'An export is already in progress. Please wait for it to complete.'
    });
  }

  let { tracks, videoClips, audioClips, projectName = `video-${Date.now()}` } = req.body;

  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
    tracks = [
      { id: 'video-track', type: 'video', name: 'Video Track', clips: videoClips || [] },
      { id: 'audio-track', type: 'audio', name: 'Audio Track', clips: audioClips || [] },
      { id: 'text-track',  type: 'text',  name: 'Text Overlays', clips: [] }
    ];
  }

  const totalClips = tracks.reduce((n, t) => n + (t.clips?.length || 0), 0);
  if (totalClips === 0) {
    return res.status(400).json({ error: 'No clips provided' });
  }

  const taskId = uuid();
  tasks[taskId] = { status: 'processing', outputUrl: null, error: null };

  processVideoAsync(taskId, { tracks, projectName });

  res.json({ taskId, message: 'Export started' });
});

// ── TASK STATUS ───────────────────────────────────────────────────────────────
app.get('/api/status/:taskId', (req, res) => {
  const task = tasks[req.params.taskId];
  if (!task) return res.status(404).json({ error: 'Invalid task ID' });
  res.json(task);
});

// ── DOWNLOAD ENDPOINT ─────────────────────────────────────────────────────────
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'outputs', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');
  res.sendFile(filePath);
});

// ── CLEAR FILES ───────────────────────────────────────────────────────────────
app.post('/api/clear-files', (req, res) => {
  try {
    ['uploads', 'outputs', 'temp'].forEach(dir => {
      const d = path.join(__dirname, dir);
      if (fs.existsSync(d)) fs.readdirSync(d).forEach(f => {
        try { fs.unlinkSync(path.join(d, f)); } catch (_) {}
      });
    });
    res.json({ success: true, message: 'All files cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── STATIC FILES ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
app.use('/audio', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Range');
  res.header('Accept-Ranges', 'bytes');
  next();
}, express.static(audioDir));

app.get('/api/audio-files', (req, res) => {
  try {
    const files = fs.existsSync(audioDir)
      ? fs.readdirSync(audioDir).filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
      : [];
    res.json({ success: true, files, audioDir });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// ── BACKGROUND PROCESSOR ──────────────────────────────────────────────────────
async function processVideoAsync(taskId, data) {
  exportInProgress = true;
  console.log(`🔒 Export lock acquired — task ${taskId}`);
  try {
    const outputPath = await videoProcessor.processTimeline(data);
    const filename   = path.basename(outputPath);
    tasks[taskId].status    = 'success';
    tasks[taskId].outputUrl = `/api/download/${filename}`;
    console.log(`✅ Task ${taskId} completed → ${filename}`);
  } catch (err) {
    tasks[taskId].status = 'failed';
    tasks[taskId].error  = err.message;
    console.error(`❌ Task ${taskId} failed:`, err.message);
  } finally {
    exportInProgress = false;
    console.log(`🔓 Export lock released`);
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 EditFlow Server Started!`);
  console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🔗 Test endpoint: ${BASE_URL}/api/test`);
});