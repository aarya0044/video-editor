import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn('⚠️ ffmpeg-static not found. Using system ffmpeg.');
}

class VideoProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp');
    this.outputsDir = path.join(__dirname, 'outputs');
    this.ensureDirs();
  }

  async ensureDirs() {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
      await fs.promises.mkdir(this.outputsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  // Helper method to find file by name (with or without timestamp)
  findFileByPartialName(partialName, uploadsDir, clipName = '') {
    try {
      if (!fs.existsSync(uploadsDir)) {
        console.error('Uploads directory not found:', uploadsDir);
        return null;
      }
      
      const files = fs.readdirSync(uploadsDir);
      console.log('📂 Available files in uploads:', files);
      
      // Decode URL-encoded filename
      const decodedFilename = decodeURIComponent(partialName);
      
      // Try exact match
      for (const file of files) {
        if (file === decodedFilename || file === partialName) {
          console.log('✅ Exact match found:', file);
          return file;
        }
      }
      
      // Try matching base name (without timestamp)
      const baseName = decodedFilename.split('-').slice(0, -1).join('-');
      if (baseName) {
        for (const file of files) {
          const fileBase = file.split('-').slice(0, -1).join('-');
          if (fileBase === baseName) {
            console.log('✅ Base name match found:', file);
            return file;
          }
        }
      }
      
      // Try matching by clip name
      if (clipName) {
        const cleanClipName = path.basename(clipName).split('.')[0];
        for (const file of files) {
          if (file.includes(cleanClipName)) {
            console.log('✅ Clip name match found:', file);
            return file;
          }
        }
      }
      
      // Try partial match as last resort
      for (const file of files) {
        if (file.includes(decodedFilename) || decodedFilename.includes(file)) {
          console.log('✅ Partial match found:', file);
          return file;
        }
      }
      
      console.log('❌ No match found for:', partialName);
      return null;
    } catch (error) {
      console.error('❌ Error in findFileByPartialName:', error);
      return null;
    }
  }

  async createSimpleVideo(clip, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('\n🎬 ======== PROCESSING CLIP ========');
      console.log('📋 Clip Info:', {
        name: clip.name,
        type: clip.type,
        start: clip.start,
        end: clip.end,
        duration: clip.end - clip.start,
        url: clip.url,
        textOverlay: clip.textOverlay
      });
      
      // ... (keep the existing file finding code) ...
      
      // Add text overlay if enabled
      if (clip.textOverlay?.enabled && clip.textOverlay.text && clip.textOverlay.text.trim() !== '') {
        console.log(`🖋️ Adding text overlay: "${clip.textOverlay.text}"`);
        
        const text = this.escapeText(clip.textOverlay.text.trim());
        const fontSize = clip.textOverlay.fontSize || 24;
        const fontColor = clip.textOverlay.fontColor || 'white';
        const position = clip.textOverlay.position || 'center';
        
        // Map position to FFmpeg coordinates
        let x, y;
        switch (position) {
          case 'center':
            x = '(w-text_w)/2';
            y = '(h-text_h)/2';
            break;
          case 'top-left':
            x = '10';
            y = '10';
            break;
          case 'top-right':
            x = '(w-text_w-10)';
            y = '10';
            break;
          case 'bottom-left':
            x = '10';
            y = '(h-text_h-10)';
            break;
          case 'bottom-right':
            x = '(w-text_w-10)';
            y = '(h-text_h-10)';
            break;
          default:
            x = '(w-text_w)/2';
            y = '(h-text_h)/2';
        }
        
        // Add background box for better readability
        const drawtextFilter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:box=1:boxcolor=black@0.5:boxborderw=5`;
        
        console.log(`   Position: ${position} -> x=${x}, y=${y}`);
        console.log(`   Font: ${fontSize}px, Color: ${fontColor}`);
        
        if (clip.type.includes('video') || clip.type.includes('audio')) {
          command = command.videoFilters(drawtextFilter);
        } else if (clip.type.includes('image')) {
          // For images, combine scaling and text
          if (clip.type.includes('image')) {
            command = command.outputOptions(['-vf', `scale=1280:720,${drawtextFilter}`]);
          } else {
            command = command.videoFilters(drawtextFilter);
          }
        }
      } else if (clip.textOverlay?.enabled && (!clip.textOverlay.text || clip.textOverlay.text.trim() === '')) {
        console.log('⚠️ Text overlay enabled but text is empty');
      }
      
      console.log('🚀 Starting FFmpeg processing...');
      
      // ... (rest of your existing code) ...
    } catch (error) {
      console.error('❌ Unexpected error in createSimpleVideo:', error);
      reject(error);
    }
  });
}
  // SIMPLER Fallback method without text overlay
  async createSimpleVideoFallback(clip, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Using SIMPLE fallback method');
        
        // Extract filename from URL
        let filename = '';
        if (clip.url.includes('/uploads/')) {
          filename = clip.url.split('/uploads/')[1];
        } else {
          const urlParts = clip.url.split('/');
          filename = urlParts[urlParts.length - 1];
        }
        filename = decodeURIComponent(filename).split('?')[0].trim();
        
        // Find the file
        const uploadsDir = path.join(__dirname, 'uploads');
        let filePath = '';
        
        if (fs.existsSync(uploadsDir)) {
          // Try direct path
          const directPath = path.join(uploadsDir, filename);
          if (fs.existsSync(directPath)) {
            filePath = directPath;
          } else {
            // Try to find file using the finder
            const foundFile = this.findFileByPartialName(filename, uploadsDir, clip.name);
            if (foundFile) {
              filePath = path.join(uploadsDir, foundFile);
            }
          }
        }
        
        if (!filePath || !fs.existsSync(filePath)) {
          reject(new Error(`File not found in fallback: ${filename}`));
          return;
        }
        
        const duration = clip.end - clip.start;
        console.log(`⏱️ Fallback processing ${clip.type} for ${duration}s`);
        
        let command;
        
        if (clip.type.includes('video')) {
          command = ffmpeg(filePath)
            .setStartTime(clip.start)
            .setDuration(duration)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions(['-pix_fmt yuv420p']);
            
        } else if (clip.type.includes('image')) {
          // ULTRA SIMPLE image to video
          command = ffmpeg(filePath)
            .inputOptions(['-loop', '1'])
            .outputOptions([
              '-t', duration.toString(),
              '-c:v', 'libx264',
              '-pix_fmt', 'yuv420p',
              '-vf', 'scale=1280:720'
            ]);
            
        } else if (clip.type.includes('audio')) {
          // Simple audio with black background
          command = ffmpeg('color=black:s=1280x720')
            .inputOptions(['-f', 'lavfi', '-t', duration.toString()])
            .input(filePath)
            .outputOptions([
              '-map', '0:v',
              '-map', '1:a',
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-shortest'
            ]);
        }
        
        command.output(outputPath)
               .on('end', () => {
                 console.log('✅ Fallback succeeded for:', clip.name);
                 resolve(outputPath);
               })
               .on('error', (err) => {
                 console.error('❌ Fallback failed:', err.message);
                 reject(err);
               })
               .run();
               
      } catch (error) {
        reject(error);
      }
    });
  }

  async concatenateVideos(videoPaths, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 Concatenating ${videoPaths.length} videos...`);
        
        // Create a file list for concatenation
        const listFilePath = path.join(this.tempDir, `concat-${Date.now()}.txt`);
        const listContent = videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        
        console.log('📝 Concat list:', listContent);
        
        // Write the list file
        fs.writeFileSync(listFilePath, listContent);
        
        // Concatenate all videos
        ffmpeg()
          .input(listFilePath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(outputPath)
          .on('start', (cmd) => {
            console.log('🔗 Concatenation command:', cmd);
          })
          .on('end', () => {
            console.log('✅ Videos concatenated successfully');
            // Clean up temp files
            try {
              fs.unlinkSync(listFilePath);
            } catch (e) {
              console.error('Error deleting list file:', e.message);
            }
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Concatenation error:', err);
            try {
              fs.unlinkSync(listFilePath);
            } catch (e) {
              console.error('Error deleting list file:', e.message);
            }
            
            // Try alternative concatenation method
            console.log('🔄 Trying alternative concatenation...');
            this.concatWithFilter(videoPaths, outputPath)
              .then(resolve)
              .catch(reject);
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Alternative concatenation method
  async concatWithFilter(videoPaths, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        let cmd = ffmpeg();
        
        videoPaths.forEach((videoPath, index) => {
          cmd = cmd.input(videoPath);
        });
        
        cmd.on('start', (command) => {
          console.log('🔗 Alternative concat command:', command);
        })
        .on('end', () => {
          console.log('✅ Alternative concatenation succeeded');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Alternative concatenation failed:', err);
          reject(err);
        })
        .mergeToFile(outputPath, this.tempDir);
      } catch (error) {
        reject(error);
      }
    });
  }

  async processTimeline(projectData) {
    const { clips, projectName } = projectData;
    const outputPath = path.join(this.outputsDir, `${projectName}.mp4`);
    
    console.log(`\n🎬 ======== STARTING EXPORT ========`);
    console.log(`📋 Project: ${projectName}`);
    console.log(`📊 Total clips: ${clips.length}`);
    
    if (clips.length === 0) {
      throw new Error('No clips to process');
    }
    
    // Process each clip individually
    const tempVideoPaths = [];
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const tempPath = path.join(this.tempDir, `clip-${i}-${Date.now()}.mp4`);
      
      console.log(`\n🎬 Processing clip ${i + 1}/${clips.length}: ${clip.name}`);
      console.log(`📝 Type: ${clip.type}, Text overlay: ${clip.textOverlay?.enabled ? 'Yes' : 'No'}`);
      
      try {
        const processedPath = await this.createSimpleVideo(clip, tempPath);
        tempVideoPaths.push(processedPath);
        console.log(`✅ Clip ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`❌ Failed to process clip ${i + 1}:`, error.message);
        // Don't stop, continue with other clips
      }
    }
    
    console.log(`\n📊 Successfully processed ${tempVideoPaths.length}/${clips.length} clips`);
    
    if (tempVideoPaths.length === 0) {
      throw new Error('No clips were processed successfully');
    }
    
    // If only one clip, just use it
    if (tempVideoPaths.length === 1) {
      console.log('📋 Only one clip, copying directly...');
      await fs.promises.copyFile(tempVideoPaths[0], outputPath);
    } else {
      // Concatenate all clips
      console.log(`🔗 Concatenating ${tempVideoPaths.length} clips...`);
      await this.concatenateVideos(tempVideoPaths, outputPath);
    }
    
    // Clean up temp clip files
    console.log('🧹 Cleaning up temp files...');
    for (const tempPath of tempVideoPaths) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (e) {
        console.error('Error deleting temp file:', e.message);
      }
    }
    
    console.log(`✅ Export completed: ${outputPath}`);
    
    return outputPath;
  }
}

export default VideoProcessor;