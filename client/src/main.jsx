import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App      from './App'
import Landing  from './pages/Landing.jsx'
import AuthPage from './pages/AuthPage.jsx'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/"       element={<Landing />} />

        {/* Auth pages */}
        <Route path="/login"  element={<AuthPage mode="login"  />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* Your existing video editor */}
        <Route path="/editor" element={<App />} />

        {/* Anything else → landing */}
        <Route path="*"       element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)