import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App      from './App'
import Landing  from './pages/Landing.jsx'
import AuthPage from './pages/AuthPage.jsx'
import { supabase } from './supabase.js'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';

// ── Blocks /editor if not logged in ──────────────────────────────────────────
function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [authed,   setAuthed]   = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecking(false);
    });
  }, []);

  if (checking) return (
    <div style={{
      minHeight:"100vh", background:"#080c0a",
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#4ade80", fontFamily:"'DM Sans',sans-serif", fontSize:14
    }}>
      Loading…
    </div>
  );

  return authed ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Default → login */}
        <Route path="/"       element={<Navigate to="/login" replace />} />

        {/* Auth */}
        <Route path="/login"  element={<AuthPage mode="login"  />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* Landing */}
        <Route path="/home"   element={<Landing />} />

        {/* Editor — must be logged in */}
        <Route path="/editor" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } />

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)