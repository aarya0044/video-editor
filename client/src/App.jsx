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
  const [previewing, setPreviewing] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);


  console.log('🔧 Current configuration:');
  console.log('🔧 Window location:', window.location.hostname);
  console.log('🔧 API_URL being used:', API_URL);
  console.log('🔧 Environment mode:', import.meta.env.MODE);

  // Debug timeline
  useEffect(() => {
    console.log('=== TIMELINE DEBUG ===');
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
      const newFiles = data.files.map(file => ({
        ...file,
        id: Date.now() + Math.random(),
        textOverlay: {
          enabled: false,
          text: '',
          fontSize: 24,
          fontColor: '#ffffff',
          position: 'center'
        }
      }));
      
      setMediaFiles(prev => [...prev, ...newFiles]);
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert(`Upload failed: ${error.message}\n\nMake sure backend is running at:\n${API_URL}`);
    } finally {
      setUploading(false);
    }
  };

  // Calculate timeline position for a new clip
  const calculateNewClipPosition = () => {
    if (timelineClips.length === 0) {
      return { timelineStart: 0, timelineEnd: 0 };
    }
    
    // Get the last clip
    const lastClip = timelineClips[timelineClips.length - 1];
    
    // If last clip has timelineEnd, use it, otherwise calculate from start/end
    const lastEnd = lastClip.timelineEnd || (lastClip.timelineStart + (lastClip.end - lastClip.start));
    
    return { 
      timelineStart: lastEnd,
      timelineEnd: lastEnd // Will be updated when we know the duration
    };
  };

  // Add file to timeline with sequential timing
  const addToTimeline = (file) => {
    const duration = file.type.includes('video') ? 5 : 3;
    const position = calculateNewClipPosition();
    
    const newClip = {
      ...file,
      id: Date.now() + Math.random(),
      start: 0, // Start time within the source file
      end: duration, // End time within the source file
      timelineStart: position.timelineStart, // Start time in timeline
      timelineEnd: position.timelineStart + duration, // End time in timeline
      textOverlay: {
        enabled: false,
        text: '',
        fontSize: 24,
        fontColor: '#ffffff',
        position: 'center'
      }
    };
    
    console.log('Adding new clip with timeline position:', newClip.timelineStart, 'to', newClip.timelineEnd);
    setTimelineClips(prev => [...prev, newClip]);
  };

  // Remove from timeline
  const removeFromTimeline = (id) => {
    setTimelineClips(prev => {
      const newClips = prev.filter(clip => clip.id !== id);
      // Recalculate timeline positions after removal
      return newClips.map((clip, index) => {
        if (index === 0) {
          return {
            ...clip,
            timelineStart: 0,
            timelineEnd: clip.end - clip.start
          };
        } else {
          const prevClip = newClips[index - 1];
          const prevEnd = prevClip.timelineEnd || (prevClip.timelineStart + (prevClip.end - prevClip.start));
          const duration = clip.end - clip.start;
          
          return {
            ...clip,
            timelineStart: prevEnd,
            timelineEnd: prevEnd + duration
          };
        }
      });
    });
    
    if (selectedClip && selectedClip.id === id) {
      setSelectedClip(null);
    }
  };

  // Move clip up/down
  const moveClip = (index, direction) => {
    const newClips = [...timelineClips];
    
    if (direction === 'up' && index > 0) {
      [newClips[index], newClips[index - 1]] = [newClips[index - 1], newClips[index]];
    } else if (direction === 'down' && index < newClips.length - 1) {
      [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
    }
    
    // Recalculate timeline positions after moving
    const updatedClips = newClips.map((clip, i) => {
      if (i === 0) {
        return {
          ...clip,
          timelineStart: 0,
          timelineEnd: clip.end - clip.start
        };
      } else {
        const prevClip = updatedClips[i - 1] || newClips[i - 1];
        const prevEnd = prevClip.timelineEnd || (prevClip.timelineStart + (prevClip.end - prevClip.start));
        const duration = clip.end - clip.start;
        
        return {
          ...clip,
          timelineStart: prevEnd,
          timelineEnd: prevEnd + duration
        };
      }
    });
    
    setTimelineClips(updatedClips);
  };

  // Update clip timing
  const updateClipTime = (id, field, value) => {
    setTimelineClips(prev => {
      const newClips = prev.map(clip => {
        if (clip.id === id) {
          const newValue = Math.max(0, parseFloat(value) || 0);
          let updatedClip = { ...clip };
          
          if (field === 'start') {
            if (newValue >= updatedClip.end) {
              updatedClip.start = updatedClip.end - 0.1;
            } else {
              updatedClip.start = newValue;
            }
          } else if (field === 'end') {
            if (newValue <= updatedClip.start) {
              updatedClip.end = updatedClip.start + 0.1;
            } else {
              updatedClip.end = newValue;
            }
          }
          
          // Update duration
          const duration = updatedClip.end - updatedClip.start;
          updatedClip.timelineEnd = updatedClip.timelineStart + duration;
          
          return updatedClip;
        }
        return clip;
      });
      
      // Recalculate timeline positions for subsequent clips
      return newClips.map((clip, index) => {
        if (index === 0) {
          return {
            ...clip,
            timelineStart: 0,
            timelineEnd: clip.end - clip.start
          };
        } else {
          const prevClip = newClips[index - 1];
          const prevEnd = prevClip.timelineEnd || (prevClip.timelineStart + (prevClip.end - prevClip.start));
          const duration = clip.end - clip.start;
          
          return {
            ...clip,
            timelineStart: prevEnd,
            timelineEnd: prevEnd + duration
          };
        }
      });
    });
  };

  // Update text overlay for selected clip
  const updateTextOverlay = (field, value) => {
    if (!selectedClip) return;
    
    setTimelineClips(prev => prev.map(clip => {
      if (clip.id === selectedClip.id) {
        return {
          ...clip,
          textOverlay: {
            ...clip.textOverlay,
            [field]: value
          }
        };
      }
      return clip;
    }));
    
    setSelectedClip(prev => ({
      ...prev,
      textOverlay: {
        ...prev.textOverlay,
        [field]: value
      }
    }));
  };

  // Toggle text overlay
  const toggleTextOverlay = () => {
    if (!selectedClip) return;
    
    updateTextOverlay('enabled', !selectedClip.textOverlay.enabled);
  };

  // Preview timeline
  const handlePreview = () => {
    if (timelineClips.length === 0) {
      alert('Add some clips to the timeline first!');
      return;
    }
    
    setPreviewing(true);
    
    // Create preview in canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas && timelineClips.length > 0) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate total duration for scaling
        const totalDuration = timelineClips[timelineClips.length - 1].timelineEnd;
        const scale = canvas.width / Math.max(totalDuration, 10);
        
        // Draw each clip representation
        timelineClips.forEach((clip, index) => {
          const timelineStart = clip.timelineStart || 0;
          const duration = clip.end - clip.start;
          const timelineEnd = clip.timelineEnd || timelineStart + duration;
          const width = (timelineEnd - timelineStart) * scale;
          const x = timelineStart * scale;
          
          // Draw clip background
          ctx.fillStyle = clip.type.includes('video') ? '#3b82f6' : 
                          clip.type.includes('image') ? '#10b981' : '#8b5cf6';
          ctx.fillRect(x + 2, 50, width - 4, 100);
          
          // Draw clip border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, 50, width - 4, 100);
          
          // Draw clip info
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px Inter';
          ctx.textAlign = 'center';
          
          // Clip name (truncated)
          const name = clip.name.length > 10 ? clip.name.substring(0, 8) + '...' : clip.name;
          if (width > 60) {
            ctx.fillText(name, x + width/2, 80);
          }
          
          // Clip timing
          if (width > 80) {
            ctx.fillText(`${timelineStart.toFixed(1)}s - ${timelineEnd.toFixed(1)}s`, x + width/2, 100);
          }
          
          // Clip type icon
          const icon = clip.type.includes('video') ? '🎥' : 
                       clip.type.includes('image') ? '🖼️' : '🎵';
          ctx.font = '20px Arial';
          ctx.fillText(icon, x + width/2, 130);
          
          // Text overlay indicator
          if (clip.textOverlay.enabled) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(x + width - 15, 55, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText('T', x + width - 15, 60);
          }
          
          // Draw clip index
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(`${index + 1}`, x + 10, 70);
        });
        
        // Draw timeline ruler
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 180);
        ctx.lineTo(canvas.width, 180);
        ctx.stroke();
        
        // Draw time markers
        ctx.font = '10px Inter';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        
        for (let i = 0; i <= totalDuration; i += 1) {
          const xPos = i * scale;
          if (xPos <= canvas.width) {
            ctx.beginPath();
            ctx.moveTo(xPos, 180);
            ctx.lineTo(xPos, 190);
            ctx.stroke();
            
            if (i % 2 === 0 && xPos > 20 && xPos < canvas.width - 20) {
              ctx.fillText(`${i}s`, xPos, 205);
            }
          }
        }
        
        // Draw total duration
        ctx.fillStyle = '#3b82f6';
        ctx.font = '12px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`Total: ${totalDuration.toFixed(1)}s`, canvas.width - 10, 220);
      }
    }, 100);
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

  // Close preview
  const closePreview = () => {
    setPreviewing(false);
  };

  // Close text editor
  const closeTextEditor = () => {
    setShowTextEditor(false);
    setSelectedClip(null);
  };

  // Calculate total duration
  const getTotalDuration = () => {
    if (timelineClips.length === 0) return 0;
    const lastClip = timelineClips[timelineClips.length - 1];
    return (lastClip.timelineEnd || (lastClip.timelineStart + (lastClip.end - lastClip.start))).toFixed(1);
  };

  // JSX return statement
  return (
    <div className="app">
      <header className="header">
        <h1>SIMPLE VIDEO EDITOR</h1>
        <p>Upload, Arrange, Export</p>
      </header>

      <main className="main-content">
        {/* Media Files Section */}
        <section className="media-section">
          <h2>📁 Media Files</h2>
          <div className="upload-area" onClick={() => fileInputRef.current.click()}>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="video/*,image/*,audio/*"
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

          {mediaFiles.length > 0 ? (
            <div className="file-list">
              <h3>Uploaded Files:</h3>
              {mediaFiles.map((file, index) => (
                <div key={file.id || index} className="file-item" onClick={() => addToTimeline(file)}>
                  <div className="file-icon">
                    {file.type.includes('video') ? '🎥' : 
                     file.type.includes('audio') ? '🎵' : '🖼️'}
                  </div>
                  <div className="file-name">{file.name}</div>
                  <button 
                    className="add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToTimeline(file);
                    }}
                  >
                    ➕ Add
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-files">
              <p>No files yet</p>
            </div>
          )}
        </section>

        {/* Timeline Section */}
        <section className="timeline-section">
          <h2>📝 Timeline ({timelineClips.length} clips)</h2>
          
          {/* Timeline Status Bar */}
          <div className="timeline-status">
            <div className="timeline-status-item">
              <span className="timeline-status-label">Total Clips</span>
              <span className="timeline-status-value">{timelineClips.length}</span>
            </div>
            <div className="timeline-status-item">
              <span className="timeline-status-label">Total Duration</span>
              <span className="timeline-status-value">{getTotalDuration()}s</span>
            </div>
            <div className="timeline-status-item">
              <span className="timeline-status-label">Status</span>
              <span className="timeline-status-value">
                {timelineClips.length === 0 ? 'Empty' : 'Ready to Export'}
              </span>
            </div>
          </div>
          
          {timelineClips.length > 0 ? (
            <div className="timeline">
              {timelineClips.map((clip, index) => {
                const duration = clip.end - clip.start;
                const timelineStart = clip.timelineStart || 0;
                const timelineEnd = clip.timelineEnd || timelineStart + duration;
                
                return (
                  <div 
                    key={clip.id} 
                    className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                    onClick={() => setSelectedClip(clip)}
                  >
                    <div className="clip-header">
                      <div className="clip-title">
                        <span className="clip-icon">
                          {clip.type.includes('video') ? '🎥' : 
                           clip.type.includes('audio') ? '🎵' : '🖼️'}
                        </span>
                        <span className="clip-name">{clip.name}</span>
                        <span className="text-indicator">#{index + 1}</span>
                        {clip.textOverlay.enabled && <span className="text-indicator">T</span>}
                      </div>
                      <div className="clip-actions">
                        <button 
                          className="move-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveClip(index, 'up');
                          }}
                          disabled={index === 0}
                          title="Move up"
                        >
                          ⬆️
                        </button>
                        <button 
                          className="move-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveClip(index, 'down');
                          }}
                          disabled={index === timelineClips.length - 1}
                          title="Move down"
                        >
                          ⬇️
                        </button>
                        <button 
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClip(clip);
                            setShowTextEditor(true);
                          }}
                          title="Edit text overlay"
                        >
                          ✏️
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromTimeline(clip.id);
                          }}
                          title="Remove from timeline"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    <div className="clip-timing">
                      <div className="time-control">
                        <label>Source Start:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={clip.start.toFixed(1)}
                          onChange={(e) => updateClipTime(clip.id, 'start', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          min="0"
                          title="Start time within source file (seconds)"
                        />
                        <span>s</span>
                      </div>
                      
                      <div className="time-control">
                        <label>Source End:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={clip.end.toFixed(1)}
                          onChange={(e) => updateClipTime(clip.id, 'end', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          min="0.1"
                          title="End time within source file (seconds)"
                        />
                        <span>s</span>
                      </div>
                      
                      <div className="time-control">
                        <label>Timeline:</label>
                        <span className="timeline-position">
                          {timelineStart.toFixed(1)}s - {timelineEnd.toFixed(1)}s
                        </span>
                      </div>
                      
                      <div className="duration">
                        Duration: {duration.toFixed(1)}s
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-timeline">
              <p>📌 Click files from Media Files to add them here</p>
              <p className="hint">Clips will automatically arrange sequentially</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              className="preview-btn"
              onClick={handlePreview}
              disabled={timelineClips.length === 0}
              title="Preview timeline arrangement"
            >
              👁️ Preview Timeline
            </button>
            
            <button 
              className="export-btn" 
              onClick={handleExport}
              disabled={exporting || timelineClips.length === 0}
              title="Export final video"
            >
              {exporting ? '⏳ Exporting...' : '🎬 Export Video'}
            </button>
          </div>

        </section>
      </main>

      <footer className="footer">
        <p>Simple Video Editor | Timeline: {timelineClips.length} clips | Total Duration: {getTotalDuration()}s</p>
      </footer>

      {/* Preview Modal */}
      {previewing && (
        <div className="preview-modal">
          <div className="preview-content">
            <div className="preview-header">
              <h3>Timeline Preview</h3>
              <button className="close-btn" onClick={closePreview}>✕</button>
            </div>
            <div className="preview-body">
              <canvas 
                ref={canvasRef}
                width="800"
                height="250"
                className="preview-canvas"
              />
              <div className="preview-info">
                <h4>Timeline Sequence:</h4>
                <ul>
                  {timelineClips.map((clip, index) => {
                    const duration = clip.end - clip.start;
                    const timelineStart = clip.timelineStart || 0;
                    const timelineEnd = clip.timelineEnd || timelineStart + duration;
                    
                    return (
                      <li key={clip.id}>
                        <strong>Clip {index + 1}:</strong> {clip.name}
                        <br />
                        <span>Type: {clip.type.includes('video') ? 'Video' : 
                                   clip.type.includes('image') ? 'Image' : 'Audio'}</span>
                        <br />
                        <span>Source: {clip.start}s - {clip.end}s (Duration: {duration.toFixed(1)}s)</span>
                        <br />
                        <span>Timeline: {timelineStart.toFixed(1)}s - {timelineEnd.toFixed(1)}s</span>
                        {clip.textOverlay.enabled && (
                          <>
                            <br />
                            <span>Text: "{clip.textOverlay.text}"</span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="preview-footer">
              <button className="close-preview-btn" onClick={closePreview}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Editor Modal */}
      {showTextEditor && selectedClip && (
        <div className="text-editor-modal">
          <div className="text-editor-content">
            <div className="text-editor-header">
              <h3>Edit Text Overlay: {selectedClip.name}</h3>
              <button className="close-btn" onClick={closeTextEditor}>✕</button>
            </div>
            <div className="text-editor-body">
              <div className="text-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedClip.textOverlay.enabled}
                    onChange={toggleTextOverlay}
                  />
                  Enable Text Overlay
                </label>
              </div>
              
              {selectedClip.textOverlay.enabled && (
                <>
                  <div className="text-input">
                    <label>Text:</label>
                    <input
                      type="text"
                      value={selectedClip.textOverlay.text}
                      onChange={(e) => updateTextOverlay('text', e.target.value)}
                      placeholder="Enter text to display"
                    />
                  </div>
                  
                  <div className="text-settings">
                    <div className="setting">
                      <label>Font Size:</label>
                      <input
                        type="range"
                        min="12"
                        max="72"
                        value={selectedClip.textOverlay.fontSize}
                        onChange={(e) => updateTextOverlay('fontSize', parseInt(e.target.value))}
                      />
                      <span>{selectedClip.textOverlay.fontSize}px</span>
                    </div>
                    
                    <div className="setting">
                      <label>Font Color:</label>
                      <input
                        type="color"
                        value={selectedClip.textOverlay.fontColor}
                        onChange={(e) => updateTextOverlay('fontColor', e.target.value)}
                      />
                    </div>
                    
                    <div className="setting">
                      <label>Position:</label>
                      <select
                        value={selectedClip.textOverlay.position}
                        onChange={(e) => updateTextOverlay('position', e.target.value)}
                      >
                        <option value="center">Center</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="text-preview">
                    <div 
                      className="preview-box"
                      style={{
                        fontSize: `${selectedClip.textOverlay.fontSize}px`,
                        color: selectedClip.textOverlay.fontColor,
                        textAlign: 'center',
                        padding: '20px',
                        backgroundColor: '#333',
                        borderRadius: '8px'
                      }}
                    >
                      {selectedClip.textOverlay.text || 'Text preview will appear here'}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="text-editor-footer">
              <button className="apply-btn" onClick={closeTextEditor}>
                Apply Changes
              </button>
              <button className="cancel-btn" onClick={closeTextEditor}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;