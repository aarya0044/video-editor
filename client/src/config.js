// client/src/config.js
const API_BASE = process.env.NODE_ENV === 'production'
  ? `https://video-editor-backend-ohnda.onrender.com`
  : `http://localhost:5000`;

export const config = {
  apiUrl: API_BASE
};

// Also export API_BASE directly for compatibility
export { API_BASE };