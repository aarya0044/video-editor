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
  findFileByPartialName(partialName, uploadsDir) {
    const files = fs.readdirSync(uploadsDir);
    
    // Try exact match first
    const exactMatch = files.find(f => f === partialName);
    if (exactMatch) return exactMatch;
    
    // Try without URL encoding
    const decodedName = decodeURIComponent(partialName);
    const decodedMatch = files.find(f => f === decodedName);
    if (decodedMatch) return decodedMatch;
    
    // Try partial match (without timestamp)
    const nameWithoutExt = partialName.replace(/\.[^/.]+$/, "");
    const timestampRegex = /-\d+$/; // Matches timestamp like -1770145553497
    
    for (const file of files) {
      const fileWithoutExt = file.replace(/\.[^/.]+$/, "");
      
      // Check if it's the same base name (ignoring timestamp)
      if (fileWithoutExt.replace(timestampRegex, '') === nameWithoutExt.replace(timestampRegex, '')) {
        return file;
      }
      
      // Also try matching just the original filename (before timestamp)
      const originalName = clip.name || '';
      if (file.includes(originalName.split('.')[0])) {
        return file;
      }
    }
    
    return null;
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
          url: clip.url
        });
        
        // Extract base filename (without URL encoding issues)
        let filename = '';
        if (clip.url.includes('/uploads/')) {
          filename = clip.url.split('/uploads/')[1];
        } else {
          const urlParts = clip.url.split('/');
          filename = urlParts[urlParts.length - 1];
        }
        
        // Remove URL encoding and clean up
        filename = decodeURIComponent(filename).trim();
        console.log('🔍 Extracted filename:', filename);
        
        // Try to find the actual file
        const uploadsDir = path.join(__dirname, 'uploads');
        let filePath = '';
        let foundFile = '';
        
        if (fs.existsSync(uploadsDir)) {
          // Try direct path first
          const directPath = path.join(uploadsDir, filename);
          if (fs.existsSync(directPath)) {
            filePath = directPath;
            foundFile = filename;
          } else {
            // Use our smart file finder
            foundFile = this.findFileByPartialName(filename, uploadsDir);
            if (foundFile) {
              filePath = path.join(uploadsDir, foundFile);
            }
          }
        } else {
          console.error('❌ Uploads directory does not exist:', uploadsDir);
          reject(new Error('Uploads directory not found'));
          return;
        }
        
        if (!filePath || !fs.existsSync(filePath)) {
          console.error('❌ File not found! Looking for:', filename);
          if (fs.existsSync(uploadsDir)) {
            console.log('📂 Available files in uploads:', fs.readdirSync(uploadsDir));
          }
          reject(new Error(`File not found: ${clip.name}`));
          return;
        }
        
        console.log('✅ Found file:', foundFile);
        console.log('📁 File path:', filePath);
        
        const duration = clip.end - clip.start;
        console.log(`⏱️ Duration: ${duration} seconds | Type: ${clip.type}`);
        
        let command;
        
        if (clip.type.includes('video')) {
          console.log('🎥 Processing as VIDEO');
          command = ffmpeg(filePath)
            .setStartTime(clip.start)
            .setDuration(duration)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-pix_fmt yuv420p',
              '-preset ultrafast',
              '-crf 28'
            ]);
            
        } else if (clip.type.includes('image')) {
          console.log('🖼️ Processing as IMAGE');
          
          command = ffmpeg(filePath)
            .inputOptions(['-loop', '1'])
            .input('anullsrc')
            .inputOptions([
              '-f', 'lavfi',
              '-t', duration.toString()
            ])
            .outputOptions([
              '-map', '0:v',
              '-map', '1:a',
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-t', duration.toString(),
              '-pix_fmt', 'yuv420p',
              '-preset', 'ultrafast',
              '-crf', '28',
              '-vf', 'scale=1280:720'
            ]);
            
        } else if (clip.type.includes('audio')) {
          console.log('🎵 Processing as AUDIO');
          
          command = ffmpeg('color=black:s=1280x720')
            .inputOptions([
              '-f', 'lavfi',
              '-t', duration.toString()
            ])
            .input(filePath)
            .outputOptions([
              '-map', '0:v',
              '-map', '1:a',
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-shortest',
              '-pix_fmt', 'yuv420p',
              '-preset', 'ultrafast',
              '-crf', '28'
            ]);
        } else {
          reject(new Error(`Unsupported file type: ${clip.type}`));
          return;
        }
        
        // Add text overlay if enabled
        if (clip.textOverlay?.enabled && clip.textOverlay.text) {
          console.log(`🖋️ Adding text overlay: "${clip.textOverlay.text}"`);
          
          const text = clip.textOverlay.text.replace(/'/g, "''");
          const fontSize = clip.textOverlay.fontSize || 24;
          const fontColor = clip.textOverlay.fontColor || 'white';
          
          const drawtextFilter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=(h-text_h)/2`;
          
          if (clip.type.includes('video') || clip.type.includes('audio')) {
            command = command.videoFilters(drawtextFilter);
          } else if (clip.type.includes('image')) {
            command = command.outputOptions(['-vf', `scale=1280:720,${drawtextFilter}`]);
          }
        }
        
        console.log('🚀 Starting FFmpeg processing...');
        
        command.output(outputPath)
               .on('start', (cmd) => {
                 console.log('🔧 FFmpeg command:', cmd);
               })
               .on('progress', (progress) => {
                 if (progress.percent) {
                   console.log(`📊 Progress: ${progress.percent.toFixed(2)}%`);
                 }
               })
               .on('end', () => {
                 console.log('✅ Clip created successfully at:', outputPath);
                 
                 if (fs.existsSync(outputPath)) {
                   const stats = fs.statSync(outputPath);
                   console.log(`✅ Output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                 }
                 
                 resolve(outputPath);
               })
               .on('error', (err, stdout, stderr) => {
                 console.error('❌ FFmpeg ERROR:', err.message);
                 console.error('❌ FFmpeg stderr:', stderr);
                 console.error('❌ FFmpeg stdout:', stdout);
                 
                 // Try SIMPLER fallback
                 console.log('🔄 Trying SIMPLER fallback...');
                 this.createSimpleVideoFallback(clip, outputPath)
                   .then(resolve)
                   .catch(fallbackError => {
                     console.error('❌ Fallback also failed:', fallbackError.message);
                     reject(new Error(`Failed to process ${clip.name}: ${err.message}`));
                   });
               })
               .run();
               
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
        filename = decodeURIComponent(filename).trim();
        
        // Find the file
        const uploadsDir = path.join(__dirname, 'uploads');
        const filePath = path.join(uploadsDir, filename);
        
        if (!fs.existsSync(filePath)) {
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