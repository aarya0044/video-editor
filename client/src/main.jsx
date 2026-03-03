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
        {/* Default: open link → login page */}
        <Route path="/"       element={<Navigate to="/login" replace />} />

        {/* Auth pages */}
        <Route path="/login"  element={<AuthPage mode="login"  />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* Landing page — reachable via "About" link on login page */}
        <Route path="/home"   element={<Landing />} />

        {/* Your existing video editor */}
        <Route path="/editor" element={<App />} />

        {/* Anything else → login */}
        <Route path="*"       element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)