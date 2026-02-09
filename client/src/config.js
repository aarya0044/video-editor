// src/config.js
export const config = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://video-editor-backend-0hda.onrender.com'
    : 'http://localhost:5000'
};