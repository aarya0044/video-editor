import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import VideoProcessor from './video-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// In index.js, make sure it's:
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = isProduction ? 'https://video-editor-backend-0hda.onrender.com' : `http://localhost:${PORT}`;

// Initialize video processor
const videoProcessor = new VideoProcessor();

// Middleware - FIXED CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // Allow Netlify + localhost
    if (
      origin.endsWith('.netlify.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }

    console.log('❌ Blocked by CORS:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
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
    const allowedTypes = /mp4|mov|avi|wmv|flv|mkv|webm|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only video and image files are allowed'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

// UPLOAD ENDPOINT - FIXED URLS
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    console.log('📁 Files received:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }
    
    const files = req.files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.originalname,
      path: `/uploads/${file.filename}`,
      type: file.mimetype,
      size: file.size,
      url: `${BASE_URL}/uploads/${file.filename}`  // FIXED: Uses BASE_URL
    }));
    
    console.log('✅ Files processed:', files.map(f => f.url));
    
    res.json({
      success: true,
      message: `Uploaded ${files.length} file(s)!`,
      files: files
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Simple test endpoint for debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    baseUrl: BASE_URL
  });
});

app.get('/api/list-files', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const outputsDir = path.join(__dirname, 'outputs');
    
    const uploads = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    const outputs = fs.existsSync(outputsDir) ? fs.readdirSync(outputsDir) : [];
    
    res.json({
      uploads,
      outputs,
      uploadsCount: uploads.length,
      outputsCount: outputs.length,
      uploadsPath: uploadsDir,
      outputsPath: outputsDir
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DEBUG ENDPOINT - Check what's in uploads folder
app.get('/api/debug-uploads', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ 
        success: true, 
        count: 0, 
        files: [],
        message: 'Uploads directory is empty'
      });
    }
    
    const files = fs.readdirSync(uploadsDir);
    
    const fileDetails = files.map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        type: path.extname(filename),
        url: `${BASE_URL}/uploads/${filename}`  // FIXED: Uses BASE_URL
      };
    });
    
    res.json({
      success: true,
      count: files.length,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// SINGLE VIDEO EXPORT ENDPOINT
app.post('/api/export-video', express.json(), async (req, res) => {
  console.log('🎬 Received video export request');
  
  try {
    const { clips, projectName = `video-${Date.now()}` } = req.body;
    
    if (!clips || clips.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No clips in timeline' 
      });
    }
    
    console.log(`📋 Processing ${clips.length} clips for project: ${projectName}`);
    
    // Set longer timeout for video processing
    req.setTimeout(300000); // 5 minutes
    
    // Process the video
    const outputPath = await videoProcessor.processTimeline({
      clips,
      projectName
    });
    
    console.log('✅ Video created at:', outputPath);
    
    // Check if file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Video file was not created');
    }
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    console.log(`📦 Video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Send the file
    res.download(outputPath, path.basename(outputPath), (err) => {
      if (err) {
        console.error('❌ Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('❌ Video export error:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      note: 'Check server console for details'
    });
  }
});

// Add this endpoint to index.js
app.post('/api/debug-clips', express.json(), (req, res) => {
  console.log('🔍 DEBUG - Received clips from frontend:');
  const { clips } = req.body;
  
  if (!clips || !Array.isArray(clips)) {
    return res.status(400).json({ error: 'No clips array provided' });
  }
  
  clips.forEach((clip, i) => {
    console.log(`\nClip ${i}:`);
    console.log(`  Name: ${clip.name}`);
    console.log(`  Type: ${clip.type}`);
    console.log(`  URL: ${clip.url}`);
    console.log(`  Start: ${clip.start}, End: ${clip.end}`);
  });
  
  res.json({ 
    success: true, 
    message: 'Clips received', 
    count: clips.length,
    clips: clips.map(c => ({ name: c.name, url: c.url, type: c.type }))
  });
});

// LEGACY EXPORT ENDPOINT (for text instructions)
app.post('/api/export', express.json(), (req, res) => {
  try {
    const { clips, projectName = 'My Video Project' } = req.body;
    
    if (!clips || clips.length === 0) {
      return res.status(400).json({ error: 'No clips in timeline' });
    }
    
    // Create outputs directory
    const outputsDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const filename = `video-instructions-${timestamp}.txt`;
    const filepath = path.join(outputsDir, filename);
    
    // Create content
    let content = `🎬 VIDEO EDITOR EXPORT INSTRUCTIONS 🎬\n\n`;
    content += `Project: ${projectName}\n`;
    content += `Export Time: ${new Date().toLocaleString()}\n\n`;
    content += `=== YOUR TIMELINE ===\n\n`;
    
    clips.forEach((clip, i) => {
      content += `Clip ${i+1}: ${clip.name}\n`;
      content += `  - Type: ${clip.type.includes('video') ? 'Video' : 'Image'}\n`;
      content += `  - Start: ${clip.start}s\n`;
      content += `  - End: ${clip.end}s\n`;
      content += `  - Duration: ${(clip.end - clip.start).toFixed(1)}s\n`;
      
      if (clip.textOverlay?.enabled && clip.textOverlay.text) {
        content += `  - Text Overlay: "${clip.textOverlay.text}"\n`;
        content += `    * Font Size: ${clip.textOverlay.fontSize}\n`;
        content += `    * Color: ${clip.textOverlay.fontColor}\n`;
        content += `    * Position: ${clip.textOverlay.x}%, ${clip.textOverlay.y}%\n`;
      }
      content += `\n`;
    });
    
    const totalDuration = clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
    content += `Total Duration: ${totalDuration.toFixed(1)} seconds\n\n`;
    
    // Write file
    fs.writeFileSync(filepath, content);
    
    // Download the file
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SERVE STATIC FILES
app.use('/uploads', express.static('uploads'));
app.use('/outputs', express.static('outputs'));

// Test endpoint to check if files are being uploaded correctly
app.get('/api/test-files', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    
    res.json({
      success: true,
      uploadsDir,
      fileCount: files.length,
      files: files.map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          url: `${BASE_URL}/uploads/${file}`
        };
      })
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all files (for testing)
app.post('/api/clear-files', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const outputsDir = path.join(__dirname, 'outputs');
    const tempDir = path.join(__dirname, 'temp');
    
    [uploadsDir, outputsDir, tempDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
          fs.unlinkSync(path.join(dir, file));
        });
      }
    });
    
    res.json({ success: true, message: 'All files cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({ 
    message: '✅ Video Editor Server is running!',
    time: new Date().toLocaleString(),
    environment: isProduction ? 'production' : 'development',
    baseUrl: BASE_URL,
    endpoints: [
      'POST /api/upload - Upload media files',
      'POST /api/export-video - Export timeline as MP4 video',
      'POST /api/export - Export timeline as text instructions',
      'GET /api/test - Test server connection'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message,
    note: 'Check server logs for details'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Video Editor Server Started!`);
  console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🔗 Test endpoint: ${BASE_URL}/api/test`);
  console.log(`📁 Uploads: ${BASE_URL}/uploads`);
  console.log(`📤 Outputs: ${BASE_URL}/outputs`);
  console.log(`🎬 Ready for video editing!`);
});
