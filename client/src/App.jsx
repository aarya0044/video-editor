import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// Add this at the beginning of your App function
const getApiUrl = () => {
  // Check localStorage for override (for testing)
  const override = localStorage.getItem('API_URL_OVERRIDE');
  if (override) {
    console.log('Using localStorage override:', override);
    return override;
  }
  
  // Production on Netlify
  if (window.location.hostname.includes('netlify.app')) {
    return 'https://video-editor-backend-0hda.onrender.com';
  }
  
  // Development
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

const API_URL = getApiUrl();

function App() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [timelineClips, setTimelineClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  console.log('🔧 Current configuration:');
  console.log('🔧 Window location:', window.location.hostname);
  console.log('🔧 API_URL being used:', API_URL);
  console.log('🔧 Environment mode:', import.meta.env.MODE);

  const [showTimelinePreview, setShowTimelinePreview] = useState(false);

  // Debug timeline
  useEffect(() => {
    console.log('=== DEBUG ===');
    console.log('Timeline clips count:', timelineClips.length);
    console.log('Timeline clips:', timelineClips);
    console.log('Selected clip:', selectedClip);
  }, [timelineClips, selectedClip]);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setUploading(true);
    try {
      console.log('📤 Uploading to:', API_URL);
      
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Upload response:', data);
      
      // Update mediaFiles state
      setMediaFiles(prev => [...prev, ...data.files]);
      
      // Add each new file to timeline
      const newClips = data.files.map(file => ({
        ...file,
        start: 0,
        end: file.type.includes('video') ? 5 : 3, // Default 5s for video, 3s for images
      }));
      
      setTimelineClips(prev => [...prev, ...newClips]);
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert(`Upload failed: ${error.message}\n\nMake sure backend is running at:\n${API_URL}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    if (timelineClips.length === 0) {
      alert('Add some clips to the timeline first!');
      return;
    }

    setExporting(true);
    try {
      console.log('🎬 Exporting with URL:', API_URL);
      
      const response = await fetch(`${API_URL}/api/export-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clips: timelineClips,
          projectName: `project_export_${Date.now()}`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} - ${errorText}`);
      }

      // Download the video
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-export-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert('✅ Video exported successfully!');
      
    } catch (error) {
      console.error('❌ Export error:', error);
      alert(`Export failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      setExporting(false);
    }
  };

  // JSX return statement
  return (
    <div className="app">
      <header className="header">
        <h1>🎬 SIMPLE VIDEO EDITOR</h1>
        <p>Upload, Arrange, Export</p>
      </header>

      <div className="container">
        {/* Left sidebar - Media files */}
        <div className="sidebar">
          <h2>📁 Media Files</h2>
          <div className="upload-area" onClick={() => fileInputRef.current.click()}>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="video/*,image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div className="upload-box">
              {uploading ? (
                <p>⏳ Uploading...</p>
              ) : (
                <>
                  <p>📤 Click to Upload</p>
                  <p className="small">Videos, Images, Audio</p>
                </>
              )}
            </div>
          </div>

          {mediaFiles.length > 0 && (
            <div className="file-list">
              <h3>Uploaded Files:</h3>
              {mediaFiles.map((file, index) => (
                <div key={index} className="file-item">
                  {file.type.includes('video') ? '🎥' : '🖼️'} {file.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main area - Timeline and Preview */}
        <div className="main">
          <h2>📝 Timeline ({timelineClips.length} clips)</h2>
          
          {timelineClips.length > 0 ? (
            <div className="timeline">
              {timelineClips.map((clip, index) => (
                <div key={index} className="timeline-clip">
                  <div className="clip-info">
                    <span>{clip.type.includes('video') ? '🎥' : '🖼️'} {clip.name}</span>
                    <span>{clip.start}s - {clip.end}s</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-timeline">
              <p>📌 Add clips to timeline to see preview</p>
            </div>
          )}

          <div className="export-section">
            <button 
              className="export-btn" 
              onClick={handleExport}
              disabled={exporting || timelineClips.length === 0}
            >
              {exporting ? '⏳ Exporting...' : '🎬 Export Video'}
            </button>
            <p className="hint">Click files from Media Library to add them here</p>
            <p className="hint">Then set start/end times and click Export!</p>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>Simple Video Editor | Timeline: {timelineClips.length} clips</p>
        <p>{new Date().toLocaleDateString()}</p>
      </footer>
    </div>
  );
}

export default App;