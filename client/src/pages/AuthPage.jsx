import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AuthPage({ mode = "login" }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab]       = useState(mode); // "login" | "signup" | "forgot"
  const [form, setForm]     = useState({ name:"", email:"", password:"", confirm:"" });
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState("");
  const [msg, setMsg]       = useState("");
  const [showPass, setShow] = useState(false);

  // Handle OAuth redirect token
  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");
    if (token) {
      localStorage.setItem("ef_token", token);
      nav("/editor");
    }
    if (error) setErr(error === "oauth_failed" ? "Google sign-in failed. Try again." : error);
  }, [params]);

  const set = k => e => { setErr(""); setForm(f => ({...f, [k]: e.target.value})); };

  const handleSubmit = async e => {
    e.preventDefault();
    setErr(""); setMsg(""); setLoad(true);
    try {
      if (tab === "forgot") {
        const r = await fetch(`${API_URL}/api/auth/forgot-password`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ email: form.email })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setMsg("Password reset email sent! Check your inbox.");
        setLoad(false); return;
      }
      if (tab === "signup" && form.password !== form.confirm) {
        throw new Error("Passwords don't match"); }
      const endpoint = tab === "login" ? "login" : "register";
      const body = tab === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const r = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Something went wrong");
      localStorage.setItem("ef_token", d.token);
      localStorage.setItem("ef_user", JSON.stringify(d.user));
      nav("/editor");
    } catch(e) { setErr(e.message); }
    setLoad(false);
  };

  const googleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const titles = {
    login:  { h: "Welcome back", sub: "Sign in to your EditFlow account" },
    signup: { h: "Create account", sub: "Start editing videos for free" },
    forgot: { h: "Reset password", sub: "We'll send a link to your email" }
  };

  return (
    <div className="auth-root">
      {/* animated background */}
      <div className="auth-bg">
        <div className="auth-orb auth-orb1" />
        <div className="auth-orb auth-orb2" />
        <div className="auth-grid" />
      </div>

      {/* back to landing */}
      <Link to="/home" className="auth-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Back
      </Link>

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">▶</div>
          <span>Edit<strong>Flow</strong></span>
        </div>

        <h1 className="auth-title">{titles[tab].h}</h1>
        <p className="auth-sub">{titles[tab].sub}</p>

        {/* Tab switcher */}
        {tab !== "forgot" && (
          <div className="auth-tabs">
            <button className={`auth-tab ${tab==="login"?"active":""}`} onClick={() => { setTab("login"); setErr(""); }}>Sign in</button>
            <button className={`auth-tab ${tab==="signup"?"active":""}`} onClick={() => { setTab("signup"); setErr(""); }}>Create account</button>
          </div>
        )}

        {/* Google OAuth */}
        {tab !== "forgot" && (
          <>
            <button className="google-btn" onClick={googleLogin}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="auth-divider"><span>or</span></div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {tab === "signup" && (
            <div className="field">
              <label>Full name</label>
              <input type="text" placeholder="Your name" value={form.name} onChange={set("name")} required autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label>Email address</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required autoComplete="email" />
          </div>
          {tab !== "forgot" && (
            <div className="field">
              <div className="field-row">
                <label>Password</label>
                {tab === "login" && (
                  <button type="button" className="forgot-link" onClick={() => { setTab("forgot"); setErr(""); }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="pass-wrap">
                <input type={showPass ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={set("password")} required autoComplete={tab==="login"?"current-password":"new-password"} />
                <button type="button" className="pass-eye" onClick={() => setShow(s => !s)}>
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          )}
          {tab === "signup" && (
            <div className="field">
              <label>Confirm password</label>
              <div className="pass-wrap">
                <input type={showPass ? "text" : "password"} placeholder="••••••••" value={form.confirm} onChange={set("confirm")} required autoComplete="new-password" />
              </div>
            </div>
          )}

          {err && <div className="auth-err">{err}</div>}
          {msg && <div className="auth-msg">{msg}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Please wait…" : tab === "login" ? "Sign in" : tab === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {tab === "forgot" && (
          <button className="auth-back-tab" onClick={() => { setTab("login"); setErr(""); setMsg(""); }}>
            ← Back to sign in
          </button>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .auth-root {
          --acc: #4ade80;
          --acc2: #22c55e;
          --bg: #080c0a;
          --bg2: #0d1410;
          --b1: rgba(255,255,255,.07);
          --b2: rgba(255,255,255,.12);
          --t1: #f0faf2;
          --t2: #a3c4aa;
          --t3: #5a7a60;
          --err: #f87171;
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }

        /* bg effects */
        .auth-bg { position:fixed; inset:0; pointer-events:none; overflow:hidden; }
        .auth-orb { position:absolute; border-radius:50%; filter:blur(80px); }
        .auth-orb1 { width:500px; height:500px; background:rgba(74,222,128,.07); top:-100px; right:-100px; }
        .auth-orb2 { width:400px; height:400px; background:rgba(74,222,128,.04); bottom:-80px; left:-80px; }
        .auth-grid {
          position:absolute; inset:0;
          background-image:linear-gradient(rgba(74,222,128,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,.03) 1px, transparent 1px);
          background-size:40px 40px;
        }

        /* back link */
        .auth-back {
          position:fixed; top:24px; left:24px;
          display:flex; align-items:center; gap:7px;
          color:var(--t2); text-decoration:none; font-size:13px; font-weight:500;
          background:rgba(255,255,255,.04); border:1px solid var(--b1);
          padding:7px 14px; border-radius:8px; transition:all .2s; z-index:10;
        }
        .auth-back:hover { color:var(--t1); background:rgba(255,255,255,.07); }

        /* card */
        .auth-card {
          position:relative; z-index:1;
          background:var(--bg2);
          border:1px solid var(--b1);
          border-radius:20px;
          padding:40px 36px;
          width:100%; max-width:420px;
          box-shadow:0 32px 64px rgba(0,0,0,.5);
          animation: slideUp .4s ease both;
        }

        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }

        .auth-logo { display:flex; align-items:center; gap:9px; font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:var(--t1); margin-bottom:28px; }
        .auth-logo-mark { width:30px; height:30px; background:var(--acc); border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#060e08; font-weight:900; }
        .auth-title { font-family:'Syne',sans-serif; font-size:24px; font-weight:800; color:var(--t1); margin-bottom:6px; letter-spacing:-.02em; }
        .auth-sub { font-size:14px; color:var(--t2); margin-bottom:24px; font-weight:300; }

        /* tabs */
        .auth-tabs { display:flex; background:rgba(255,255,255,.04); border-radius:10px; padding:4px; margin-bottom:20px; border:1px solid var(--b1); }
        .auth-tab { flex:1; padding:8px; border:none; background:transparent; color:var(--t2); font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; border-radius:7px; transition:all .2s; }
        .auth-tab.active { background:var(--bg); color:var(--t1); font-weight:600; box-shadow:0 1px 6px rgba(0,0,0,.3); }

        /* google */
        .google-btn {
          width:100%; padding:11px; background:rgba(255,255,255,.05);
          border:1px solid var(--b2); border-radius:10px;
          color:var(--t1); font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
          transition:all .2s;
        }
        .google-btn:hover { background:rgba(255,255,255,.09); border-color:rgba(255,255,255,.2); }

        /* divider */
        .auth-divider { display:flex; align-items:center; gap:12px; margin:18px 0; color:var(--t3); font-size:12px; }
        .auth-divider::before, .auth-divider::after { content:''; flex:1; height:1px; background:var(--b1); }

        /* form */
        .auth-form { display:flex; flex-direction:column; gap:16px; }
        .field { display:flex; flex-direction:column; gap:6px; }
        .field label { font-size:12px; font-weight:600; color:var(--t2); letter-spacing:.04em; text-transform:uppercase; }
        .field-row { display:flex; justify-content:space-between; align-items:center; }
        .field input {
          background:rgba(255,255,255,.04); border:1px solid var(--b1);
          border-radius:9px; padding:11px 14px; color:var(--t1);
          font-family:'DM Sans',sans-serif; font-size:14px; font-weight:400;
          outline:none; transition:border-color .2s;
          width:100%;
        }
        .field input:focus { border-color:rgba(74,222,128,.4); background:rgba(74,222,128,.03); }
        .field input::placeholder { color:var(--t3); }
        .pass-wrap { position:relative; }
        .pass-wrap input { padding-right:44px; }
        .pass-eye { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--t3); cursor:pointer; padding:4px; display:flex; align-items:center; transition:color .2s; }
        .pass-eye:hover { color:var(--t2); }
        .forgot-link { background:none; border:none; color:var(--acc); font-size:12px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; padding:0; }
        .forgot-link:hover { text-decoration:underline; }

        /* errors/messages */
        .auth-err { background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.25); color:var(--err); font-size:13px; padding:10px 14px; border-radius:8px; }
        .auth-msg { background:rgba(74,222,128,.1); border:1px solid rgba(74,222,128,.25); color:var(--acc); font-size:13px; padding:10px 14px; border-radius:8px; }

        /* submit */
        .auth-submit {
          width:100%; padding:13px; background:var(--acc); color:#060e08;
          border:none; border-radius:10px; font-family:'DM Sans',sans-serif;
          font-size:15px; font-weight:700; cursor:pointer; transition:all .2s;
          display:flex; align-items:center; justify-content:center; gap:8px;
          margin-top:4px;
        }
        .auth-submit:hover:not(:disabled) { background:var(--acc2); transform:translateY(-1px); }
        .auth-submit:disabled { opacity:.6; cursor:not-allowed; }

        .spinner { width:16px; height:16px; border:2px solid rgba(0,0,0,.2); border-top-color:#060e08; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .auth-back-tab { background:none; border:none; color:var(--acc); font-size:13px; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:16px; display:block; width:100%; text-align:center; }

        @media (max-width:480px) {
          .auth-card { padding:28px 20px; }
        }
      `}</style>
    </div>
  );
}