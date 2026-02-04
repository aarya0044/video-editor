import fetch from 'node-fetch';

async function testExport() {
  try {
    // First, check what files are uploaded
    const debugRes = await fetch('http://localhost:5000/api/debug-uploads');
    const debugData = await debugRes.json();
    console.log('📂 Uploaded files:', debugData.files.map(f => f.name));
    
    // Create a test export with the first 3 uploaded files
    const files = debugData.files.slice(0, 3);
    const clips = files.map((file, index) => ({
      url: file.url,
      name: file.name,
      type: file.name.match(/\.(mp4|mov|avi|mkv)$/) ? 'video/mp4' : 'image/jpeg',
      start: index * 2,
      end: index * 2 + 2,
      textOverlay: {
        enabled: false,
        text: '',
        fontSize: 24,
        fontColor: '#FFFFFF',
        x: 50,
        y: 50,
        backgroundColor: 'transparent'
      }
    }));
    
    console.log('📝 Test clips:', clips);
    
    // Export the video
    const exportRes = await fetch('http://localhost:5000/api/export-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clips,
        projectName: 'test-export'
      }),
    });
    
    if (exportRes.ok) {
      console.log('✅ Export successful');
    } else {
      const error = await exportRes.json();
      console.error('❌ Export failed:', error);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testExport();