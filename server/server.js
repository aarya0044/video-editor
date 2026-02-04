const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/outputs', express.static('outputs'));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Create uploads and outputs directories if they don't exist
const directories = ['uploads', 'outputs'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Upload endpoint
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files.map(file => ({
      originalname: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    }));
    
    console.log('Files uploaded:', files);
    
    res.json({ 
      success: true, 
      message: 'Files uploaded successfully',
      files: files 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export endpoint (simplified - in real app you'd use ffmpeg)
app.post('/api/export', (req, res) => {
  try {
    const { projectName } = req.body;
    const outputPath = path.join(__dirname, 'outputs', `${projectName}-export.mp4`);
    
    // Create a dummy file for demonstration
    const dummyContent = 'This is a dummy video file. In a real app, this would be actual video data processed with ffmpeg.';
    fs.writeFileSync(outputPath, dummyContent);
    
    // Send the file
    res.download(outputPath, `${projectName}-export.mp4`, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ success: false, message: 'Error downloading file' });
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete endpoint
app.delete('/api/delete/:filename', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('File deleted:', req.params.filename);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all uploaded files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync('uploads').map(filename => ({
      filename,
      path: `/uploads/${filename}`,
      size: fs.statSync(path.join('uploads', filename)).size
    }));
    
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`📁 Output directory: ${path.join(__dirname, 'outputs')}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});