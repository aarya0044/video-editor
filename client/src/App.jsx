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

  // ✅ SINGLE SOURCE OF TRUTH for API URL
  const API_URL = (() => {
    // If we're on Netlify (production), use the Render backend
    if (window.location.hostname.includes('netlify.app')) {
      return 'https://video-editor-backend-0hda.onrender.com';
    }
    // For local development, check environment variable or use localhost
    return import.meta.env.VITE_API_URL || 'http://localhost:5000';
  })();

  console.log('🔧 Current configuration:');
  console.log('🔧 Window location:', window.location.hostname);
  console.log('🔧 API_URL being used:', API_URL);
  console.log('🔧 Environment mode:', import.meta.env.MODE);

  const [showTimelinePreview, setShowTimelinePreview] = useState(false);

  // Add debugging
  useEffect(() => {
    console.log('=== DEBUG ===');
    console.log('Timeline clips count:', timelineClips.length);
    console.log('Timeline clips:', timelineClips);
    console.log('Selected clip:', selectedClip);
  }, [timelineClips, selectedClip]);

  // Add this useEffect to automatically adjust subsequent clip start times
  useEffect(() => {
    const updatedClips = [...timelineClips];
    let currentTime = 0;
    
    for (let i = 0; i < updatedClips.length; i++) {
      const clip = updatedClips[i];
      const duration = clip.end - clip.start;
      
      updatedClips[i] = {
        ...clip,
        start: currentTime,
        end: currentTime + duration
      };
      
      currentTime += duration;
    }
    
    // Only update if clips have changed
    if (JSON.stringify(updatedClips) !== JSON.stringify(timelineClips)) {
      setTimelineClips(updatedClips);
    }
  }, [timelineClips.length]); // Run when number of clips changes

  // PREVIEW MODAL COMPONENT
  const TimelinePreviewModal = () => {
    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const videoRef = useRef(null);
    
    if (!timelineClips || timelineClips.length === 0) {
      return null;
    }

    const safeClipIndex = Math.min(currentClipIndex, timelineClips.length - 1);
    const currentClip = timelineClips[safeClipIndex];
    
    if (!currentClip && timelineClips.length > 0) {
      setCurrentClipIndex(0);
      return null;
    }

    const totalDuration = timelineClips.reduce((sum, clip) => {
      if (!clip || typeof clip.start !== 'number' || typeof clip.end !== 'number') return sum;
      return sum + (clip.end - clip.start);
    }, 0);
    
    const clipStartTime = timelineClips.slice(0, safeClipIndex).reduce((sum, clip) => {
      if (!clip || typeof clip.start !== 'number' || typeof clip.end !== 'number') return sum;
      return sum + (clip.end - clip.start);
    }, 0);
    
    const clipDuration = currentClip ? (currentClip.end - currentClip.start) : 0;
    
    // Reset preview when timelineClips changes
    useEffect(() => {
      setCurrentClipIndex(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsVideoLoaded(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }, [timelineClips.length]);
    
    // Timer for all clips
    useEffect(() => {
      let interval;
      
      if (isPlaying) {
        interval = setInterval(() => {
          setCurrentTime(prev => {
            const newTime = prev + 0.1;
            
            if (newTime >= clipStartTime + clipDuration) {
              if (safeClipIndex < timelineClips.length - 1) {
                setCurrentClipIndex(prevIndex => prevIndex + 1);
                return clipStartTime + clipDuration;
              } else {
                setIsPlaying(false);
                return totalDuration;
              }
            }
            
            return newTime;
          });
        }, 100);
      }
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isPlaying, safeClipIndex, clipStartTime, clipDuration, totalDuration, timelineClips.length]);
    
    // Handle video seeking when currentTime changes
    useEffect(() => {
      if (currentClip?.type.includes('video') && videoRef.current && isVideoLoaded) {
        const timeInClip = currentTime - clipStartTime;
        if (timeInClip >= 0 && timeInClip <= clipDuration) {
          videoRef.current.currentTime = timeInClip;
        }
      }
    }, [currentTime, currentClip, clipStartTime, clipDuration, isVideoLoaded]);
    
    // Handle video play/pause
    useEffect(() => {
      if (!currentClip?.type.includes('video') || !videoRef.current || !isVideoLoaded) return;
      
      const video = videoRef.current;
      
      if (isPlaying) {
        video.play().catch(e => {
          console.error("Video play error:", e);
          setIsPlaying(false);
        });
      } else {
        video.pause();
      }
    }, [isPlaying, currentClip, isVideoLoaded]);
    
    // Reset video when clip changes
    useEffect(() => {
      if (currentClip?.type.includes('video')) {
        console.log('🔄 Loading new video:', currentClip.url);
        
        setIsVideoLoaded(false);
        
        if (videoRef.current) {
          videoRef.current.src = currentClip.url;
          videoRef.current.load();
          
          const handleCanPlay = () => {
            setIsVideoLoaded(true);
            console.log('✅ Video loaded');
          };
          
          videoRef.current.addEventListener('canplay', handleCanPlay);
          
          return () => {
            if (videoRef.current) {
              videoRef.current.removeEventListener('canplay', handleCanPlay);
            }
          };
        }
      } else {
        setIsVideoLoaded(true);
      }
    }, [currentClip]);
    
    const handlePlayPause = () => {
      setIsPlaying(!isPlaying);
    };
    
    const handleTimelineChange = (e) => {
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
      
      let accumulatedTime = 0;
      let newIndex = 0;
      for (let i = 0; i < timelineClips.length; i++) {
        const clip = timelineClips[i];
        const duration = clip.end - clip.start;
        if (newTime >= accumulatedTime && newTime < accumulatedTime + duration) {
          newIndex = i;
          break;
        }
        accumulatedTime += duration;
      }
      
      setCurrentClipIndex(newIndex);
    };
    
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    
    const handleClose = () => {
      setShowTimelinePreview(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentClipIndex(0);
      setIsVideoLoaded(false);
      
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
    
    const handleClipClick = (index) => {
      const clipStart = timelineClips.slice(0, index).reduce((sum, c) => sum + (c.end - c.start), 0);
      setCurrentTime(clipStart);
      setCurrentClipIndex(index);
      setIsPlaying(false);
      
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '25px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid #eee',
            paddingBottom: '15px'
          }}>
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#3498db' }}>🔍</span>
                Timeline Preview
              </h2>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                Showing {timelineClips.length} clips • Total duration: {formatTime(totalDuration)}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>✕</span> Close
            </button>
          </div>
          
          {/* Preview Player */}
          <div style={{ 
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            background: '#111',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '20px',
            border: '3px solid #2c3e50'
          }}>
            {currentClip ? (
              <>
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: currentClip.type.includes('image') ? '#000' : 'transparent'
                }}>
                  {currentClip.type.includes('video') ? (
                    <video
                      ref={videoRef}
                      src={currentClip.url}
                      key={currentClip.id}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                      muted={true}
                      preload="auto"
                      playsInline
                      onLoadedData={() => {
                        console.log('📹 Video loaded data');
                        setIsVideoLoaded(true);
                      }}
                      onError={(e) => {
                        console.error('❌ Video error:', e);
                        setIsVideoLoaded(false);
                      }}
                    />
                  ) : currentClip.type.includes('image') ? (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      <img
                        key={currentClip.id}
                        src={currentClip.url}
                        alt="Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => console.error("Image error:", e)}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      fontSize: '24px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎵</div>
                        <div>Audio Clip</div>
                        <div style={{ fontSize: '16px', opacity: 0.8 }}>{currentClip.name}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Text Overlay */}
                  {currentClip.textOverlay?.enabled && currentClip.textOverlay.text && (
                    <div style={{
                      position: 'absolute',
                      top: currentClip.textOverlay.y + '%',
                      left: currentClip.textOverlay.x + '%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: currentClip.textOverlay.fontSize + 'px',
                      color: currentClip.textOverlay.fontColor,
                      backgroundColor: currentClip.textOverlay.backgroundColor,
                      padding: currentClip.textOverlay.backgroundColor === 'transparent' ? '0' : '8px 15px',
                      borderRadius: '5px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      border: currentClip.textOverlay.backgroundColor === 'transparent' ? 'none' : '1px solid rgba(0,0,0,0.2)',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                      zIndex: 10
                    }}>
                      {currentClip.textOverlay.text}
                    </div>
                  )}
                </div>
                
                {/* Progress Bar Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'rgba(255,255,255,0.2)'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(currentTime / totalDuration) * 100}%`,
                    background: 'linear-gradient(90deg, #3498db, #2ecc71)',
                    transition: 'width 0.1s linear'
                  }} />
                </div>
                
                {/* Clip Info Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.85)',
                  color: 'white',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: currentClip.type.includes('video') ? '#e74c3c' : 
                                   currentClip.type.includes('audio') ? '#9b59b6' : '#27ae60',
                        color: 'white',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {safeClipIndex + 1}
                      </div>
                      <div>
                        <strong style={{ fontSize: '16px' }}>{currentClip.name}</strong>
                        {currentClip.textOverlay?.enabled && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#2ecc71',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span>📝</span> Text: "{currentClip.textOverlay.text}"
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.1)',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </div>
                  </div>
                </div>
                
                {/* Play/Pause Overlay */}
                {!isPlaying && (
                  <div
                    onClick={handlePlayPause}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.4)',
                      cursor: 'pointer',
                      opacity: 0.8,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'rgba(52, 152, 219, 0.9)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                      color: 'white'
                    }}>
                      ▶️
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#95a5a6',
                fontSize: '18px'
              }}>
                No clip selected
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div style={{
            background: '#f8f9fa',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button
                onClick={handlePlayPause}
                style={{
                  background: isPlaying ? '#e74c3c' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px 25px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: '120px'
                }}
              >
                {isPlaying ? (
                  <>
                    <span>⏸️</span> Pause
                  </>
                ) : (
                  <>
                    <span>▶️</span> Play
                  </>
                )}
              </button>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    Clip {safeClipIndex + 1} of {timelineClips.length}
                  </span>
                  <span style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                    {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalDuration}
                  step="0.1"
                  value={currentTime}
                  onChange={handleTimelineChange}
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #3498db 0%, #3498db ' + (currentTime / totalDuration * 100) + '%, #e0e0e0 ' + (currentTime / totalDuration * 100) + '%, #e0e0e0 100%)',
                    cursor: 'pointer',
                    WebkitAppearance: 'none'
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Timeline Overview */}
          <div style={{
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <h4 style={{ 
              marginTop: 0, 
              marginBottom: '15px',
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>📋</span> Timeline Overview
            </h4>
            <div style={{ 
              display: 'flex', 
              overflowX: 'auto', 
              padding: '10px 0',
              gap: '4px'
            }}>
              {timelineClips.map((clip, index) => {
                const duration = clip.end - clip.start;
                const clipStart = timelineClips.slice(0, index).reduce((sum, c) => sum + (c.end - c.start), 0);
                const widthPercent = (duration / totalDuration) * 100;
                
                return (
                  <div
                    key={clip.id}
                    onClick={() => handleClipClick(index)}
                    style={{
                      flex: `0 0 ${Math.max(widthPercent, 10)}%`,
                      minWidth: '80px',
                      background: index === safeClipIndex ? '#3498db' : 
                                 (clip.textOverlay?.enabled ? '#e8f6f3' : '#ecf0f1'),
                      border: index === safeClipIndex ? '3px solid #2980b9' : '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '12px',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      ':hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '5px',
                      color: index === safeClipIndex ? 'white' : '#2c3e50'
                    }}>
                      {index + 1}. {clip.name}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: index === safeClipIndex ? 'rgba(255,255,255,0.9)' : '#666'
                    }}>
                      {duration.toFixed(1)}s
                    </div>
                    
                    {/* Clip type indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      fontSize: '12px'
                    }}>
                      {clip.type.includes('video') ? '🎬' : 
                       clip.type.includes('audio') ? '🎵' : '🖼️'}
                    </div>
                    
                    {/* Text overlay indicator */}
                    {clip.textOverlay?.enabled && (
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: '#27ae60',
                        color: 'white',
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        TEXT
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // REAL UPLOAD TO SERVER
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        const newFiles = data.files.map(file => ({
          id: Date.now() + Math.random(),
          name: file.name,
          url: `${API_BASE}${file.path}`,
          serverPath: file.path,
          type: file.type,
          duration: file.type.includes('video') ? 10 : 
                   file.type.includes('audio') ? 5 : 3,
        }));
        
        setMediaFiles(prev => [...prev, ...newFiles]);
        alert(`✅ Uploaded ${newFiles.length} file(s) successfully!`);
        
        // Auto-add first file to timeline for convenience
        if (newFiles.length > 0 && timelineClips.length === 0) {
          addToTimeline(newFiles[0]);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Upload failed: ${error.message}\n\nMake sure the server is running.`);
    } finally {
      setUploading(false);
    }
  };

  // Add file to timeline
  const addToTimeline = (file) => {
    const totalDurationSoFar = timelineClips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
    
    const defaultDuration = file.type.includes('video') ? 5 : 3;
    
    const newClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      url: file.url,
      type: file.type,
      start: totalDurationSoFar,
      end: totalDurationSoFar + defaultDuration,
      textOverlay: {
        enabled: false,
        text: '',
        fontSize: 24,
        fontColor: '#FFFFFF',
        position: 'center',
        backgroundColor: 'transparent',
        x: 50,
        y: 50
      }
    };
    
    console.log('Adding clip to timeline:', newClip);
    
    setTimelineClips(prev => {
      const updated = [...prev, newClip];
      console.log('Updated timeline clips:', updated);
      return updated;
    });
    
    setSelectedClip(newClip);
  };

  // Simple timeline controls
  const moveClip = (clipId, direction) => {
    const index = timelineClips.findIndex(c => c.id === clipId);
    if (direction === 'left' && index > 0) {
      const newClips = [...timelineClips];
      [newClips[index], newClips[index-1]] = [newClips[index-1], newClips[index]];
      setTimelineClips(newClips);
    }
    if (direction === 'right' && index < timelineClips.length - 1) {
      const newClips = [...timelineClips];
      [newClips[index], newClips[index+1]] = [newClips[index+1], newClips[index]];
      setTimelineClips(newClips);
    }
  };

  // Export function
  const exportVideo = async () => {
    if (timelineClips.length === 0) {
      alert("Add some clips to timeline first!");
      return;
    }
    
    // Show detailed summary
    const videoClips = timelineClips.filter(c => c.type.includes('video')).length;
    const imageClips = timelineClips.filter(c => c.type.includes('image')).length;
    const audioClips = timelineClips.filter(c => c.type.includes('audio')).length;
    const textClips = timelineClips.filter(c => c.textOverlay?.enabled && c.textOverlay.text).length;
    const totalDuration = timelineClips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
    
    const proceed = window.confirm(`🎬 VIDEO EXPORT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━
Total Clips: ${timelineClips.length}
• Videos: ${videoClips}
• Images: ${imageClips}
• Audio: ${audioClips}
• Text Overlays: ${textClips}
• Total Duration: ${totalDuration.toFixed(1)}s
━━━━━━━━━━━━━━━━━━━━━━━━━
This will create a video with all your clips,
including text overlays and audio.

Click OK to start export (may take a while)...`);
    
    if (!proceed) return;
    
    setExporting(true);
    
    try {
      console.log('📤 Sending export request:', timelineClips);
      
      const response = await fetch(`${API_BASE}/api/export-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clips: timelineClips.map(clip => ({
            url: clip.url,
            name: clip.name,
            type: clip.type,
            start: clip.start,
            end: clip.end,
            textOverlay: clip.textOverlay
          })),
          projectName: `video-${Date.now()}`
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `video-export-${Date.now()}.mp4`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert(`✅ Video exported successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━
File: ${filename}
Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB
Clips: ${timelineClips.length}
━━━━━━━━━━━━━━━━━━━━━━━━━
Your download should start automatically.`);
      
    } catch (error) {
      console.error('❌ Export error:', error);
      
      alert(`❌ Export failed!
━━━━━━━━━━━━━━━━━━━━━━━━━
Error: ${error.message}

Possible issues:
1. Server is not running
2. Uploaded files are missing
3. FFmpeg processing error

Check browser console for details.`);
    } finally {
      setExporting(false);
    }
  };

  // Debug function to check server files
  const debugServerFiles = async () => {
    try {
      console.log('🔍 Checking server files...');
      const response = await fetch(`${API_BASE}/api/debug-uploads`);
      const data = await response.json();
      
      console.log('📁 Server files:', data);
      
      alert(`📊 Server File Status:
• Total files on server: ${data.count}
• Files: ${data.files.map(f => `\n  - ${f.name} (${f.size} bytes)`).join('')}

• Timeline clips: ${timelineClips.length}
• Timeline files: ${timelineClips.map(c => `\n  - ${c.name} → ${c.url.split('/').pop()}`).join('')}

Check browser console for full details.`);
      
    } catch (error) {
      alert('Debug failed: ' + error.message);
    }
  };

  // Test server connection
  const testServerConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/test`);
      const data = await response.json();
      alert(`✅ Server is running!\n\nMessage: ${data.message}\n\nEndpoints:\n- ${data.endpoints.join('\n- ')}`);
    } catch (error) {
      alert('❌ Server not reachable!\n\nMake sure server is running:\n1. Open terminal in /server folder\n2. Run: node index.js\n3. Wait for "✅ Server running at http://localhost:5000"');
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* HEADER */}
      <div style={{ 
        background: '#2c3e50', 
        color: 'white', 
        padding: '15px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <h1 style={{ margin: 0 }}>🎬 SIMPLE VIDEO EDITOR</h1>
        <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>Upload, Arrange, Export</p>
        
        {/* DEBUG BUTTON */}
        <button 
          onClick={debugServerFiles}
          style={{
            position: 'absolute',
            top: '10px',
            right: '120px',
            background: '#9b59b6',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Debug Files
        </button>
        
        {/* SERVER TEST BUTTON */}
        <button 
          onClick={testServerConnection}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Test Server
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        backgroundColor: '#f5f5f5'
      }}>
        
        {/* LEFT: MEDIA LIBRARY */}
        <div style={{ 
          width: '250px', 
          padding: '15px',
          borderRight: '2px solid #ddd',
          overflowY: 'auto'
        }}>
          <h3 style={{ marginTop: 0 }}>
            📁 Media Files 
            {mediaFiles.length > 0 && (
              <span style={{ 
                fontSize: '14px', 
                color: '#3498db',
                marginLeft: '10px',
                background: '#ecf0f1',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {mediaFiles.length} loaded
              </span>
            )}
          </h3>
          
          {/* UPLOAD BUTTON */}
          <div 
            onClick={() => fileInputRef.current.click()}
            style={{
              border: '2px dashed #3498db',
              padding: '20px',
              textAlign: 'center',
              borderRadius: '8px',
              marginBottom: '15px',
              cursor: 'pointer',
              backgroundColor: '#ecf0f1'
            }}
          >
            <div style={{ fontSize: '24px' }}>📤</div>
            <div style={{ fontWeight: 'bold' }}>Click to Upload</div>
            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
              Videos, Images, Audio
            </div>
          </div>

          {/* HIDDEN FILE INPUT */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            onChange={(e) => handleUpload(e.target.files)}
            style={{ display: 'none' }}
          />

          {/* FILE LIST */}
          <div>
            {mediaFiles.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#95a5a6',
                padding: '20px'
              }}>
                No files yet
              </div>
            ) : (
              mediaFiles.map(file => (
                <div
                  key={file.id}
                  onClick={() => addToTimeline(file)}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ 
                    width: '30px', 
                    height: '30px',
                    background: file.type.includes('video') ? '#e74c3c' : 
                               file.type.includes('audio') ? '#9b59b6' : '#2ecc71',
                    color: 'white',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    {file.type.includes('video') ? '🎬' : 
                     file.type.includes('audio') ? '🎵' : '🖼️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                      {file.type.includes('video') ? 'Video' : 
                       file.type.includes('audio') ? 'Audio' : 'Image'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: PREVIEW & TIMELINE */}
        <div style={{ 
          flex: 1, 
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          
          {/* PREVIEW */}
          <div style={{ 
            marginBottom: '20px',
            background: '#fff',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ marginTop: 0 }}>🔍 Preview</h3>
            {selectedClip && selectedClip.url ? (
              <div>
                {selectedClip.type.includes('video') ? (
                  <video 
                    controls 
                    src={selectedClip.url} 
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      borderRadius: '5px'
                    }}
                  />
                ) : selectedClip.type.includes('image') ? (
                  <img 
                    src={selectedClip.url} 
                    alt="Preview"
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '5px'
                    }}
                  />
                ) : (
                  <audio 
                    controls 
                    src={selectedClip.url}
                    style={{ width: '100%' }}
                  />
                )}
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
                  {selectedClip.name}
                </p>
              </div>
            ) : timelineClips.length > 0 ? (
              <div>
                {timelineClips[0].type.includes('video') ? (
                  <video 
                    controls 
                    src={timelineClips[0].url} 
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      borderRadius: '5px'
                    }}
                  />
                ) : timelineClips[0].type.includes('image') ? (
                  <img 
                    src={timelineClips[0].url} 
                    alt="Preview"
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '5px'
                    }}
                  />
                ) : (
                  <audio 
                    controls 
                    src={timelineClips[0].url}
                    style={{ width: '100%' }}
                  />
                )}
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
                  {timelineClips[0].name}
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                    (First clip in timeline - click any clip below to select it)
                  </span>
                </p>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                color: '#bdc3c7'
              }}>
                Add clips to timeline to see preview
              </div>
            )}
          </div>

          {/* TIMELINE */}
          <div style={{ 
            flex: 1,
            background: '#fff',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>⏱️ Timeline</h3>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginRight: '10px',
                  display: timelineClips.length > 0 ? 'block' : 'none'
                }}>
                  {timelineClips.length} clip{timelineClips.length !== 1 ? 's' : ''}
                </span>

                {/* PREVIEW BUTTON */}
                <button
                  onClick={() => {
                    if (timelineClips.length === 0) {
                      alert("Add some clips to timeline first!");
                      return;
                    }
                    setShowTimelinePreview(true);
                  }}
                  disabled={timelineClips.length === 0}
                  style={{
                    background: timelineClips.length === 0 ? '#95a5a6' : '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: timelineClips.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginRight: '10px',
                    opacity: timelineClips.length === 0 ? 0.7 : 1
                  }}
                >
                  🔍 Preview Timeline
                </button>

                {/* EXPORT BUTTON */}
                <button
                  onClick={exportVideo}
                  disabled={exporting}
                  style={{
                    background: exporting ? '#95a5a6' : '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    opacity: exporting ? 0.7 : 1
                  }}
                >
                  {exporting ? '⏳ Processing...' : '🎥 Export Video'}
                </button>

                 {showTimelinePreview && <TimelinePreviewModal />}
              </div>
            </div>

            {timelineClips.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '30px',
                color: '#95a5a6'
              }}>
                👆 Click files from Media Library to add them here
                <div style={{ marginTop: '10px', fontSize: '14px' }}>
                  Then set start/end times and click Export!
                </div>
              </div>
            ) : (
              <div>
                {timelineClips.map((clip, index) => (
                  <div
                    key={clip.id}
                    onClick={() => {
                      console.log('Selecting clip:', clip);
                      setSelectedClip(clip);
                    }}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      background: selectedClip?.id === clip.id ? '#3498db' : '#ecf0f1',
                      color: selectedClip?.id === clip.id ? 'white' : 'black',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ flex: 1, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ marginRight: '10px' }}>
                          {clip.type.includes('video') ? '🎬' : 
                           clip.type.includes('audio') ? '🎵' : '🖼️'}
                        </div>
                        <div>
                          <strong>{clip.name}</strong>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            Start: {clip.start.toFixed(1)}s | End: {clip.end.toFixed(1)}s | Duration: {(clip.end - clip.start).toFixed(1)}s
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {index > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveClip(clip.id, 'left');
                          }}
                          style={{
                            background: '#f39c12',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          ←
                        </button>
                      )}
                      
                      {index < timelineClips.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveClip(clip.id, 'right');
                          }}
                          style={{
                            background: '#f39c12',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          →
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTimelineClips(prev => prev.filter(c => c.id !== clip.id));
                          if (selectedClip?.id === clip.id) setSelectedClip(null);
                        }}
                        style={{
                          background: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                {/* Timeline Summary */}
                {timelineClips.length > 0 && (
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '15px', 
                    background: '#e8f4fd',
                    borderRadius: '8px',
                    border: '1px solid #bee3f8'
                  }}>
                    <h4 style={{ marginTop: 0, color: '#2c5282' }}>🎬 Timeline Summary</h4>
                    
                    <div style={{ fontSize: '14px' }}>
                      {timelineClips.map((clip, index) => (
                        <div key={clip.id} style={{ 
                          padding: '8px', 
                          marginBottom: '5px',
                          background: index % 2 === 0 ? '#fff' : '#f7fafc',
                          borderRadius: '4px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 'bold' }}>
                              {index + 1}. {clip.type.includes('video') ? '🎬' : '🖼️'} {clip.name}
                            </span>
                            <span style={{ color: '#4a5568' }}>
                              {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#718096', marginTop: '3px' }}>
                            Duration: {(clip.end - clip.start).toFixed(1)} seconds
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ 
                      marginTop: '10px', 
                      padding: '10px',
                      background: '#2c5282',
                      color: 'white',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <strong>Total Duration: {timelineClips.reduce((sum, clip) => sum + (clip.end - clip.start), 0).toFixed(1)} seconds</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: PROPERTIES */}
        <div style={{ 
          width: '250px', 
          padding: '15px',
          borderLeft: '2px solid #ddd',
          overflowY: 'auto',
          background: '#fff'
        }}>
          <h3 style={{ marginTop: 0 }}>⚙️ Properties</h3>
          
          {selectedClip ? (
            <div>
              <div style={{ 
                padding: '10px', 
                background: '#f8f9fa',
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                <strong>Selected:</strong> {selectedClip.name}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Position: {timelineClips.findIndex(c => c.id === selectedClip.id) + 1} of {timelineClips.length}
                </div>
              </div>
              
              {/* BASIC PROPERTIES */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <h4 style={{ marginTop: 0, fontSize: '16px' }}>📏 Clip Timing</h4>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                    Start Time (auto-calculated):
                    <div style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '5px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      background: '#f5f5f5',
                      color: '#666'
                    }}>
                      {selectedClip.start.toFixed(1)} seconds
                    </div>
                  </label>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                    Clip Duration (seconds):
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={(selectedClip.end - selectedClip.start).toFixed(1)}
                      onChange={(e) => {
                        const newDuration = parseFloat(e.target.value) || 1;
                        const newEnd = selectedClip.start + newDuration;
                        
                        setSelectedClip({...selectedClip, end: newEnd});
                        setTimelineClips(prev => prev.map(c => 
                          c.id === selectedClip.id ? {...c, end: newEnd} : c
                        ));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginTop: '5px',
                        borderRadius: '4px',
                        border: '1px solid #ddd'
                      }}
                    />
                  </label>
                </div>
              </div>
              
              {/* TEXT OVERLAY SECTION */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ marginTop: 0, fontSize: '16px' }}>🖋️ Text Overlay</h4>
                  <button
                    onClick={() => {
                      const updatedClip = {
                        ...selectedClip,
                        textOverlay: {
                          ...selectedClip.textOverlay,
                          enabled: !selectedClip.textOverlay.enabled
                        }
                      };
                      setSelectedClip(updatedClip);
                      setTimelineClips(prev => prev.map(c => 
                        c.id === selectedClip.id ? updatedClip : c
                      ));
                    }}
                    style={{
                      background: selectedClip.textOverlay?.enabled ? '#27ae60' : '#95a5a6',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {selectedClip.textOverlay?.enabled ? 'ON ✓' : 'OFF'}
                  </button>
                </div>
                
                {selectedClip.textOverlay?.enabled && (
                  <div style={{ 
                    padding: '10px', 
                    background: '#f0f8ff',
                    borderRadius: '5px',
                    border: '1px solid #cce7ff'
                  }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                        Text:
                        <textarea
                          value={selectedClip.textOverlay.text}
                          onChange={(e) => {
                            const updatedClip = {
                              ...selectedClip,
                              textOverlay: {
                                ...selectedClip.textOverlay,
                                text: e.target.value
                              }
                            };
                            setSelectedClip(updatedClip);
                            setTimelineClips(prev => prev.map(c => 
                              c.id === selectedClip.id ? updatedClip : c
                            ));
                          }}
                          placeholder="Enter text to overlay"
                          rows="3"
                          style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            resize: 'vertical',
                            fontFamily: 'Arial, sans-serif'
                          }}
                        />
                      </label>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                          Font Size:
                          <input
                            type="number"
                            min="10"
                            max="100"
                            value={selectedClip.textOverlay.fontSize}
                            onChange={(e) => {
                              const updatedClip = {
                                ...selectedClip,
                                textOverlay: {
                                  ...selectedClip.textOverlay,
                                  fontSize: parseInt(e.target.value)
                                }
                              };
                              setSelectedClip(updatedClip);
                              setTimelineClips(prev => prev.map(c => 
                                c.id === selectedClip.id ? updatedClip : c
                              ));
                            }}
                            style={{
                              width: '100%',
                              padding: '5px',
                              marginTop: '3px',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                        </label>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                          Color:
                          <input
                            type="color"
                            value={selectedClip.textOverlay.fontColor}
                            onChange={(e) => {
                              const updatedClip = {
                                ...selectedClip,
                                textOverlay: {
                                  ...selectedClip.textOverlay,
                                  fontColor: e.target.value
                                }
                              };
                              setSelectedClip(updatedClip);
                              setTimelineClips(prev => prev.map(c => 
                                c.id === selectedClip.id ? updatedClip : c
                              ));
                            }}
                            style={{
                              width: '100%',
                              height: '30px',
                              marginTop: '3px',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                        Position:
                        <select
                          value={selectedClip.textOverlay.position}
                          onChange={(e) => {
                            let x, y;
                            switch(e.target.value) {
                              case 'top-left': x = 10; y = 10; break;
                              case 'top-center': x = 50; y = 10; break;
                              case 'top-right': x = 90; y = 10; break;
                              case 'center': x = 50; y = 50; break;
                              case 'bottom-left': x = 10; y = 90; break;
                              case 'bottom-center': x = 50; y = 90; break;
                              case 'bottom-right': x = 90; y = 90; break;
                              default: x = 50; y = 50;
                            }
                            
                            const updatedClip = {
                              ...selectedClip,
                              textOverlay: {
                                ...selectedClip.textOverlay,
                                position: e.target.value,
                                x, y
                              }
                            };
                            setSelectedClip(updatedClip);
                            setTimelineClips(prev => prev.map(c => 
                              c.id === selectedClip.id ? updatedClip : c
                            ));
                          }}
                          style={{
                            width: '100%',
                            padding: '5px',
                            marginTop: '5px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        >
                          <option value="top-left">Top Left</option>
                          <option value="top-center">Top Center</option>
                          <option value="top-right">Top Right</option>
                          <option value="center">Center</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-center">Bottom Center</option>
                          <option value="bottom-right">Bottom Right</option>
                        </select>
                      </label>
                    </div>
                    
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                        Background:
                        <select
                          value={selectedClip.textOverlay.backgroundColor}
                          onChange={(e) => {
                            const updatedClip = {
                              ...selectedClip,
                              textOverlay: {
                                ...selectedClip.textOverlay,
                                backgroundColor: e.target.value
                              }
                            };
                            setSelectedClip(updatedClip);
                            setTimelineClips(prev => prev.map(c => 
                              c.id === selectedClip.id ? updatedClip : c
                            ));
                          }}
                          style={{
                            width: '100%',
                            padding: '5px',
                            marginTop: '5px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        >
                          <option value="transparent">Transparent</option>
                          <option value="#00000080">Black (Semi)</option>
                          <option value="#FFFFFF80">White (Semi)</option>
                          <option value="#000000">Black</option>
                          <option value="#FFFFFF">White</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* TIMING INFO */}
              <div style={{ 
                padding: '10px', 
                background: '#e8f4fd', 
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                <div style={{ color: '#2c5282' }}>
                  <strong>Clip ends at:</strong> {selectedClip.end.toFixed(1)}s
                </div>
                <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '5px' }}>
                  Next clip starts automatically
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '30px',
              color: '#95a5a6'
            }}>
              Select a clip to edit properties
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ 
        background: '#34495e', 
        color: 'white', 
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '14px'
      }}>
        <div>🎬 Simple Video Editor | Timeline: {timelineClips.length} clips</div>
        <div>{new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
}

export default App;