// test-export-direct.js
import VideoProcessor from './video-processor.js';

async function testExport() {
  const processor = new VideoProcessor();
  
  // Test with the EXACT data your frontend should send
  const testClips = [
    {
      name: "WhatsApp Image 2026-01-22 at 10.54.59 AM.jpeg",
      type: "image/jpeg",
      start: 0,
      end: 5,
      url: "http://localhost:5000/uploads/WhatsApp%20Image%202026-01-22%20at%2010.54.59%20AM-1770145553497.jpeg",
      textOverlay: { enabled: false }
    },
    {
      name: "AM.jpeg", 
      type: "image/jpeg",
      start: 5,
      end: 8,
      url: "http://localhost:5000/uploads/WhatsApp%20Image%202026-01-22%20at%2010.54.59%20AM-1770147482812.jpeg",
      textOverlay: { enabled: false }
    },
    {
      name: "IMG-20251231-WA0000.jpg",
      type: "image/jpeg",
      start: 8,
      end: 13,
      url: "http://localhost:5000/uploads/IMG-20251231-WA0000-1770145553506.jpg",
      textOverlay: { enabled: false }
    }
  ];
  
  try {
    console.log('🧪 Testing full export with 3 images...');
    const result = await processor.processTimeline({
      clips: testClips,
      projectName: 'test-all-images'
    });
    console.log('✅ Export successful! Output:', result);
    
    // Check if file exists and show size
    const fs = await import('fs');
    const stats = fs.statSync(result);
    console.log(`📦 Output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testExport();