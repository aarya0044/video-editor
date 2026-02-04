import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

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
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  async createSimpleVideo(clip, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎬 Creating video from clip:', clip.name);
        
        // Extract filename from URL
        const urlParts = clip.url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const filePath = path.join(__dirname, 'uploads', filename);
        
        console.log('📁 Looking for file at:', filePath);
        
        // Check if file exists
        if (!existsSync(filePath)) {
          console.error('❌ File not found:', filePath);
          reject(new Error(`File not found: ${filename}`));
          return;
        }
        
        const duration = clip.end - clip.start;
        console.log(`⏱️ Duration: ${duration} seconds`);
        
        let command;
        
        if (clip.type.includes('video')) {
          // For video files
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
          // For image files - create video from image with silent audio
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
              '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'
            ]);
        } else {
          reject(new Error(`Unsupported file type: ${clip.type}`));
          return;
        }
        
        // Add text overlay if enabled - CORRECTED VERSION
        if (clip.textOverlay?.enabled && clip.textOverlay.text) {
          console.log(`🖋️ Adding text overlay: "${clip.textOverlay.text}"`);
          
          // Escape special characters in text
          const text = clip.textOverlay.text
            .replace(/'/g, "'\\''")
            .replace(/\\/g, '\\\\');
          
          const fontSize = clip.textOverlay.fontSize || 24;
          const fontColor = clip.textOverlay.fontColor || '#FFFFFF';
          
          // Convert hex color to FFmpeg format (remove # if present)
          const ffmpegFontColor = fontColor.startsWith('#') ? fontColor.substring(1) : fontColor;
          
          const x = clip.textOverlay.x || 50;
          const y = clip.textOverlay.y || 50;
          
          // Build the drawtext filter
          let drawtextFilter = `drawtext=`;
          drawtextFilter += `text='${text}':`;
          drawtextFilter += `fontsize=${fontSize}:`;
          drawtextFilter += `fontcolor=${ffmpegFontColor}@1.0:`; // @1.0 for full opacity
          drawtextFilter += `x=(w-text_w)*${x/100}:`;
          drawtextFilter += `y=(h-text_h)*${y/100}:`;
          drawtextFilter += `fontfile='C\\:/Windows/Fonts/arial.ttf':`; // Windows font path
          
          // Add background box if specified
          if (clip.textOverlay.backgroundColor && clip.textOverlay.backgroundColor !== 'transparent') {
            const bgColor = clip.textOverlay.backgroundColor.startsWith('#') 
              ? clip.textOverlay.backgroundColor.substring(1) 
              : clip.textOverlay.backgroundColor;
            
            // For black background with hex 000000, FFmpeg expects 0x000000
            if (bgColor === '000000' || bgColor === 'black') {
              drawtextFilter += `box=1:boxcolor=0x000000@0.7:boxborderw=5`;
            } else if (bgColor === 'FFFFFF' || bgColor === 'white') {
              drawtextFilter += `box=1:boxcolor=0xFFFFFF@0.7:boxborderw=5`;
            } else {
              // Convert hex to 0x format
              const boxColor = `0x${bgColor}`;
              drawtextFilter += `box=1:boxcolor=${boxColor}@0.7:boxborderw=5`;
            }
          }
          
          console.log(`📝 Drawtext filter: ${drawtextFilter}`);
          
          // Apply the filter to the command
          if (clip.type.includes('video')) {
            // For video, use videoFilters
            command = command.videoFilters(drawtextFilter);
          } else if (clip.type.includes('image')) {
            // For image, we need to modify the existing filter chain
            const existingFilter = command._getArguments().find(arg => arg.includes('scale='));
            if (existingFilter) {
              // Replace the existing filter with one that includes drawtext
              const newFilter = `${existingFilter},${drawtextFilter}`;
              command = command.outputOptions(['-vf', newFilter]);
            } else {
              command = command.videoFilters(drawtextFilter);
            }
          }
        }
        
        command.output(outputPath)
               .on('start', (cmd) => {
                 console.log('🚀 FFmpeg command:', cmd);
               })
               .on('progress', (progress) => {
                 if (progress.percent) {
                   console.log(`📊 Processing: ${progress.percent.toFixed(2)}%`);
                 }
               })
               .on('end', () => {
                 console.log('✅ Video created successfully at:', outputPath);
                 
                 // Verify the file was created
                 if (existsSync(outputPath)) {
                   const stats = statSync(outputPath);
                   console.log(`✅ Output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                 }
                 
                 resolve(outputPath);
               })
               .on('error', (err, stdout, stderr) => {
                 console.error('❌ FFmpeg error:', err.message);
                 console.error('❌ FFmpeg stderr:', stderr);
                 console.error('❌ FFmpeg stdout:', stdout);
                 
                 // Try a simpler approach without text overlay as fallback
                 console.log('🔄 Trying fallback without text overlay...');
                 this.createSimpleVideoFallback(clip, outputPath)
                   .then(resolve)
                   .catch(reject);
               })
               .run();
               
      } catch (error) {
        console.error('❌ Error setting up command:', error);
        console.error('❌ Error stack:', error.stack);
        reject(error);
      }
    });
  }

  // Fallback method without text overlay
  async createSimpleVideoFallback(clip, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Using fallback method (no text overlay)');
        
        const urlParts = clip.url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const filePath = path.join(__dirname, 'uploads', filename);
        
        const duration = clip.end - clip.start;
        
        let command;
        
        if (clip.type.includes('video')) {
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
          command = ffmpeg(filePath)
            .inputOptions(['-loop', '1'])
            .input('anullsrc')
            .inputOptions(['-f', 'lavfi', '-t', duration.toString()])
            .outputOptions([
              '-map', '0:v',
              '-map', '1:a',
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-t', duration.toString(),
              '-pix_fmt', 'yuv420p',
              '-preset', 'ultrafast',
              '-crf', '28'
            ]);
        }
        
        command.output(outputPath)
               .on('end', () => resolve(outputPath))
               .on('error', reject)
               .run();
               
      } catch (error) {
        reject(error);
      }
    });
  }

  async concatenateVideos(videoPaths, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Create a file list for concatenation
        const listFilePath = path.join(this.tempDir, `concat-${Date.now()}.txt`);
        const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
        
        // Write the list file
        fs.writeFile(listFilePath, listContent)
          .then(() => {
            // Concatenate all videos
            ffmpeg()
              .input(listFilePath)
              .inputOptions(['-f', 'concat', '-safe', '0'])
              .outputOptions(['-c', 'copy'])
              .output(outputPath)
              .on('start', (cmd) => {
                console.log('🔗 Concatenating videos:', cmd);
              })
              .on('end', () => {
                console.log('✅ Videos concatenated successfully');
                // Clean up temp files
                fs.unlink(listFilePath).catch(console.error);
                resolve(outputPath);
              })
              .on('error', (err) => {
                console.error('❌ Concatenation error:', err);
                fs.unlink(listFilePath).catch(console.error);
                reject(err);
              })
              .run();
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async processTimeline(projectData) {
    const { clips, projectName } = projectData;
    const outputPath = path.join(this.outputsDir, `${projectName}.mp4`);
    
    console.log(`🎬 Processing timeline with ${clips.length} clips`);
    
    if (clips.length === 0) {
      throw new Error('No clips to process');
    }
    
    // Process each clip individually
    const tempVideoPaths = [];
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const tempPath = path.join(this.tempDir, `clip-${i}-${Date.now()}.mp4`);
      
      console.log(`🎬 Processing clip ${i + 1}/${clips.length}: ${clip.name}`);
      console.log(`📝 Text overlay enabled: ${clip.textOverlay?.enabled ? 'Yes' : 'No'}`);
      
      try {
        const processedPath = await this.createSimpleVideo(clip, tempPath);
        tempVideoPaths.push(processedPath);
      } catch (error) {
        console.error(`❌ Failed to process clip ${i + 1}:`, error.message);
        // Continue with other clips
      }
    }
    
    if (tempVideoPaths.length === 0) {
      throw new Error('No clips were processed successfully');
    }
    
    // If only one clip, just use it
    if (tempVideoPaths.length === 1) {
      await fs.copyFile(tempVideoPaths[0], outputPath);
    } else {
      // Concatenate all clips
      await this.concatenateVideos(tempVideoPaths, outputPath);
    }
    
    // Clean up temp clip files
    for (const tempPath of tempVideoPaths) {
      await fs.unlink(tempPath).catch(console.error);
    }
    
    return outputPath;
  }
}

export default VideoProcessor;