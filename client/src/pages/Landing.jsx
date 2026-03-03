import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ── tiny helpers ── */
const Tag = ({ children }) => (
  <span style={{
    display:"inline-block", padding:"3px 10px", borderRadius:20,
    background:"rgba(74,222,128,.12)", color:"#4ade80",
    fontSize:11, fontWeight:700, letterSpacing:".08em",
    textTransform:"uppercase", border:"1px solid rgba(74,222,128,.25)"
  }}>{children}</span>
);

const FeatureCard = ({ icon, title, desc, delay }) => (
  <div className="feat-card" style={{"--d": delay + "ms"}}>
    <div className="feat-icon">{icon}</div>
    <h3 className="feat-title">{title}</h3>
    <p className="feat-desc">{desc}</p>
  </div>
);

const StepCard = ({ n, title, desc }) => (
  <div className="step-card">
    <div className="step-num">{String(n).padStart(2,"0")}</div>
    <div>
      <h4 className="step-title">{title}</h4>
      <p className="step-desc">{desc}</p>
    </div>
  </div>
);

const PricingCard = ({ plan, price, priceINR, desc, features, highlight, cta }) => (
  <div className={`price-card ${highlight ? "price-highlight" : ""}`}>
    {highlight && <div className="price-badge">Most Popular</div>}
    <div className="price-plan">{plan}</div>
    <div className="price-amount">
      <span className="price-currency">$</span>{price}
      <span className="price-per">/mo</span>
    </div>
    <div className="price-inr">≈ ₹{priceINR}/mo</div>
    <p className="price-desc">{desc}</p>
    <div className="price-divider" />
    <ul className="price-features">
      {features.map((f,i) => (
        <li key={i}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {f}
        </li>
      ))}
    </ul>
    <button className={`price-btn ${highlight ? "price-btn-highlight" : ""}`}>{cta}</button>
  </div>
);

export default function Landing() {
  const nav = useNavigate();
  const heroRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    const onMouse = e => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mousemove", onMouse);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("mousemove", onMouse); };
  }, []);

  return (
    <div className="land-root">
      {/* Ambient glow that follows cursor */}
      <div className="cursor-glow" style={{
        left: mousePos.x - 300, top: mousePos.y - 300
      }} />

      {/* ── NAV ── */}
      <nav className={`land-nav ${scrolled ? "land-nav-blur" : ""}`}>
        <div className="nav-logo">
          <div className="logo-mark">▶</div>
          <span>Edit<strong>Flow</strong></span>
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-cta">
          <button className="btn-ghost" onClick={() => nav("/login")}>Sign in</button>
          <button className="btn-primary" onClick={() => nav("/signup")}>Start free</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section" ref={heroRef}>
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <Tag>Browser-based · No install needed</Tag>
          <h1 className="hero-title">
            Edit videos.<br />
            <span className="hero-accent">Ship faster.</span>
          </h1>
          <p className="hero-sub">
            Professional video editing in your browser. Trim, layer, add music, burn subtitles — then export in any ratio. No software downloads.
          </p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={() => nav("/signup")}>
              Start editing free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button className="btn-ghost btn-lg" onClick={() => nav("/login")}>
              Sign in
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat"><span className="stat-n">4</span><span className="stat-l">Export ratios</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-n">6min</span><span className="stat-l">Max timeline</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-n">200MB</span><span className="stat-l">Max upload</span></div>
          </div>
        </div>

        {/* App mockup */}
        <div className="hero-mockup">
          <div className="mockup-bar">
            <span /><span /><span />
          </div>
          <div className="mockup-body">
            <div className="mockup-topbar">
              <div className="mockup-logo">▶ EditFlow</div>
              <div className="mockup-btn">Export Video</div>
            </div>
            <div className="mockup-main">
              <div className="mockup-sidebar">
                <div className="mockup-tab active">Media</div>
                <div className="mockup-tab">Music</div>
                <div className="mockup-tab">Text</div>
                <div style={{flex:1}} />
                <div className="mockup-file">video.mp4</div>
                <div className="mockup-file">photo.jpg</div>
                <div className="mockup-file">track.mp3</div>
              </div>
              <div className="mockup-preview">
                <div className="mockup-canvas">
                  <div className="mockup-play">▶</div>
                  <div className="mockup-timecode">0:13.83</div>
                </div>
              </div>
            </div>
            <div className="mockup-timeline">
              <div className="mockup-track">
                <div className="mockup-track-label">VIDEO</div>
                <div className="mockup-clip c1">BigBuckBunny.mp4</div>
                <div className="mockup-clip c2">photo.jpg</div>
              </div>
              <div className="mockup-track">
                <div className="mockup-track-label">AUDIO</div>
                <div className="mockup-clip c3" style={{width:"80%"}} />
              </div>
              <div className="mockup-track">
                <div className="mockup-track-label">TEXT</div>
                <div className="mockup-clip c4" style={{width:"25%",marginLeft:"40%"}}>hii</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="features-section">
        <div className="section-label">
          <Tag>Features</Tag>
        </div>
        <h2 className="section-title">Everything you need.<br/>Nothing you don't.</h2>
        <div className="feat-grid">
          <FeatureCard delay={0}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
            title="Multi-track timeline"
            desc="Layer video clips, images, background music and text overlays on a visual timeline editor."
          />
          <FeatureCard delay={80}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>}
            title="4 export ratios"
            desc="Export in 16:9 for YouTube, 9:16 for Reels/TikTok, 1:1 for Instagram, or 4:5 portrait."
          />
          <FeatureCard delay={160}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
            title="Background music"
            desc="Add royalty-free music tracks or upload your own audio. Control volume and timing."
          />
          <FeatureCard delay={240}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            title="Text overlays"
            desc="Add styled text with custom fonts, colors and positions. Burns into the exported video."
          />
          <FeatureCard delay={320}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>}
            title="No install needed"
            desc="Runs entirely in your browser. Upload, edit and export — then download the final MP4."
          />
          <FeatureCard delay={400}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            title="Smart chunking"
            desc="Long videos are automatically split and processed in parallel so exports never time out."
          />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section" id="how">
        <Tag>How it works</Tag>
        <h2 className="section-title">From upload to download<br/>in minutes.</h2>
        <div className="steps-layout">
          <div className="steps-list">
            <StepCard n={1} title="Upload your media" desc="Drag and drop videos, images, and audio files. Up to 200MB per file." />
            <StepCard n={2} title="Build your timeline" desc="Arrange clips, trim, add music and text overlays on the visual timeline." />
            <StepCard n={3} title="Choose your ratio" desc="Pick 16:9, 9:16, 1:1 or 4:5 depending on where you're publishing." />
            <StepCard n={4} title="Export & download" desc="Hit Export. Your video is processed on the server and downloaded as MP4." />
          </div>
          <div className="steps-visual">
            <div className="steps-card-mockup">
              <div className="scm-row">
                <div className="scm-file">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  BigBuckBunny.mp4
                </div>
                <div className="scm-size">158MB</div>
              </div>
              <div className="scm-row">
                <div className="scm-file">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  horse.jpg
                </div>
                <div className="scm-size">2.1MB</div>
              </div>
              <div className="scm-row">
                <div className="scm-file">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>
                  background.mp3
                </div>
                <div className="scm-size">4.8MB</div>
              </div>
              <div className="scm-divider" />
              <div className="scm-ratio-row">
                {["16:9","9:16","1:1","4:5"].map(r => (
                  <div key={r} className={`scm-ratio ${r === "9:16" ? "active" : ""}`}>{r}</div>
                ))}
              </div>
              <div className="scm-export-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exporting… 73%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="pricing-section" id="pricing">
        <Tag>Pricing</Tag>
        <h2 className="section-title">Simple, usage-based pricing.</h2>
        <p className="pricing-sub">Start free. Pay only when your instance is actively processing.</p>
        <div className="pricing-grid">
          <PricingCard
            plan="Free"
            price="0"
            priceINR="0"
            desc="Perfect for trying out the editor."
            features={[
              "512MB RAM instance",
              "Up to 6 min timeline",
              "720p max export",
              "200MB upload limit",
              "Scale-to-zero (sleeps when idle)"
            ]}
            cta="Get started free"
          />
          <PricingCard
            plan="Starter"
            price="~1.30"
            priceINR="~119"
            desc="For regular video editing work."
            highlight
            features={[
              "2GB RAM instance",
              "Up to 20 min timeline",
              "1080p export",
              "500MB upload limit",
              "Faster exports (~3–4 min)",
              "No resolution downscaling"
            ]}
            cta="Upgrade to Starter"
          />
          <PricingCard
            plan="Pro"
            price="~2.59"
            priceINR="~236"
            desc="For heavy video production."
            features={[
              "4GB RAM + 2 vCPU",
              "Up to 45 min timeline",
              "4K input supported",
              "1GB upload limit",
              "Fastest exports (~1–2 min)",
              "No chunking needed"
            ]}
            cta="Upgrade to Pro"
          />
        </div>
        <p className="pricing-note">* Compute prices based on 3hr/day active usage on Koyeb Starter plan. Scale-to-zero means you pay ₹0 when idle.</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="land-footer">
        <div className="footer-logo">
          <div className="logo-mark">▶</div>
          <span>Edit<strong>Flow</strong></span>
        </div>
        <p className="footer-copy">Built with React + Express + FFmpeg. Deployed on Koyeb + Vercel.</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .land-root {
          --acc: #4ade80;
          --acc2: #22c55e;
          --bg: #080c0a;
          --bg2: #0d1410;
          --bg3: #111a14;
          --b1: rgba(255,255,255,.07);
          --b2: rgba(255,255,255,.12);
          --t1: #f0faf2;
          --t2: #a3c4aa;
          --t3: #5a7a60;
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--t1);
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* cursor glow */
        .cursor-glow {
          position: fixed;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74,222,128,.06) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
          transition: left .12s ease, top .12s ease;
        }

        /* ── NAV ── */
        .land-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          transition: background .3s, border-bottom .3s;
        }
        .land-nav-blur {
          background: rgba(8,12,10,.85);
          border-bottom: 1px solid var(--b1);
          backdrop-filter: blur(16px);
        }
        .nav-logo { display:flex; align-items:center; gap:10px; font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--t1); text-decoration:none; }
        .logo-mark { width:32px; height:32px; background:var(--acc); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; color:#060e08; font-weight:900; }
        .nav-links { display:flex; gap:32px; }
        .nav-links a { color:var(--t2); text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; }
        .nav-links a:hover { color:var(--t1); }
        .nav-cta { display:flex; gap:10px; }

        /* buttons */
        .btn-primary { background:var(--acc); color:#060e08; border:none; padding:9px 20px; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:all .2s; }
        .btn-primary:hover { background:var(--acc2); transform:translateY(-1px); }
        .btn-ghost { background:transparent; color:var(--t2); border:1px solid var(--b2); padding:9px 20px; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; }
        .btn-ghost:hover { color:var(--t1); border-color:var(--b2); background:rgba(255,255,255,.04); }
        .btn-lg { padding:13px 28px; font-size:15px; border-radius:10px; }

        /* ── HERO ── */
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          gap: 60px;
          padding: 120px 48px 80px;
          overflow: hidden;
        }
        .hero-grid-bg {
          position: absolute; inset: 0; z-index: 0;
          background-image: linear-gradient(rgba(74,222,128,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at 60% 40%, black 20%, transparent 75%);
        }
        .hero-content { position:relative; z-index:1; }
        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(48px, 5vw, 72px);
          font-weight: 800;
          line-height: 1.05;
          margin: 18px 0 20px;
          letter-spacing: -.03em;
        }
        .hero-accent { color: var(--acc); }
        .hero-sub { font-size:17px; color:var(--t2); line-height:1.65; max-width:460px; font-weight:300; margin-bottom:36px; }
        .hero-btns { display:flex; gap:12px; margin-bottom:48px; }
        .hero-stats { display:flex; align-items:center; gap:24px; }
        .stat { display:flex; flex-direction:column; gap:3px; }
        .stat-n { font-family:'Syne',sans-serif; font-size:22px; font-weight:700; color:var(--t1); }
        .stat-l { font-size:12px; color:var(--t3); font-weight:400; letter-spacing:.04em; }
        .stat-div { width:1px; height:32px; background:var(--b1); }

        /* mockup */
        .hero-mockup { position:relative; z-index:1; }
        .mockup-bar { background:#1a2a1e; border-radius:14px 14px 0 0; padding:12px 16px; display:flex; gap:7px; border-bottom:1px solid var(--b1); }
        .mockup-bar span { width:11px; height:11px; border-radius:50%; background:var(--b2); }
        .mockup-bar span:nth-child(1) { background:#ff5f57; }
        .mockup-bar span:nth-child(2) { background:#febc2e; }
        .mockup-bar span:nth-child(3) { background:#28c840; }
        .mockup-body { background:#0d1a10; border-radius:0 0 14px 14px; border:1px solid var(--b1); border-top:none; overflow:hidden; box-shadow:0 40px 80px rgba(0,0,0,.6); }
        .mockup-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--b1); background:#0a1510; }
        .mockup-logo { font-family:'Syne',sans-serif; font-size:13px; font-weight:700; color:var(--acc); }
        .mockup-btn { background:var(--acc); color:#060e08; font-size:11px; font-weight:700; padding:5px 12px; border-radius:6px; }
        .mockup-main { display:flex; height:180px; }
        .mockup-sidebar { width:130px; border-right:1px solid var(--b1); padding:10px 8px; display:flex; flex-direction:column; gap:6px; background:#080f0a; }
        .mockup-tab { font-size:10px; color:var(--t3); padding:5px 8px; border-radius:5px; cursor:pointer; font-weight:500; }
        .mockup-tab.active { background:rgba(74,222,128,.1); color:var(--acc); }
        .mockup-file { font-size:9px; color:var(--t3); padding:4px 8px; background:rgba(255,255,255,.03); border-radius:4px; border:1px solid var(--b1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mockup-preview { flex:1; display:flex; align-items:center; justify-content:center; position:relative; background:#060c08; }
        .mockup-canvas { width:120px; height:68px; background:#0a1510; border:1px solid var(--b1); border-radius:4px; display:flex; align-items:center; justify-content:center; position:relative; }
        .mockup-play { font-size:18px; color:rgba(255,255,255,.3); }
        .mockup-timecode { position:absolute; top:4px; right:6px; font-family:'DM Mono',monospace; font-size:8px; color:var(--t3); }
        .mockup-timeline { border-top:1px solid var(--b1); background:#080c08; padding:8px 0; }
        .mockup-track { display:flex; align-items:center; height:22px; gap:0; }
        .mockup-track-label { width:50px; font-size:8px; color:var(--t3); font-weight:700; letter-spacing:.08em; padding-left:10px; flex-shrink:0; }
        .mockup-clip { height:16px; border-radius:3px; font-size:8px; display:flex; align-items:center; padding:0 6px; font-weight:500; white-space:nowrap; overflow:hidden; }
        .c1 { background:rgba(96,165,250,.25); color:#93c5fd; width:55%; }
        .c2 { background:rgba(167,139,250,.25); color:#c4b5fd; width:20%; margin-left:1%; }
        .c3 { background:rgba(74,222,128,.2); }
        .c4 { background:rgba(251,191,36,.2); color:#fde68a; }

        /* ── FEATURES ── */
        .features-section {
          padding: 100px 48px;
          text-align: center;
          position: relative; z-index:1;
        }
        .section-label { margin-bottom:16px; }
        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(32px, 3.5vw, 48px);
          font-weight: 800;
          line-height: 1.1;
          margin: 12px 0 56px;
          letter-spacing: -.02em;
        }
        .feat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; max-width:960px; margin:0 auto; }
        .feat-card {
          background: var(--bg2);
          border: 1px solid var(--b1);
          border-radius: 14px;
          padding: 28px 24px;
          text-align: left;
          transition: border-color .2s, transform .2s;
          animation: fadeUp .5s var(--d) both;
        }
        .feat-card:hover { border-color:rgba(74,222,128,.3); transform:translateY(-3px); }
        .feat-icon { width:44px; height:44px; background:rgba(74,222,128,.1); border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:16px; color:var(--acc); }
        .feat-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; margin-bottom:8px; }
        .feat-desc { font-size:13.5px; color:var(--t2); line-height:1.6; font-weight:300; }

        /* ── HOW IT WORKS ── */
        .how-section {
          padding: 100px 48px;
          max-width: 1100px;
          margin: 0 auto;
          position:relative; z-index:1;
        }
        .steps-layout { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; margin-top:48px; }
        .steps-list { display:flex; flex-direction:column; gap:0; }
        .step-card { display:flex; gap:20px; padding:24px 0; border-bottom:1px solid var(--b1); }
        .step-card:last-child { border-bottom:none; }
        .step-num { font-family:'DM Mono',monospace; font-size:13px; color:var(--acc); font-weight:500; padding-top:2px; flex-shrink:0; width:28px; }
        .step-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; margin-bottom:5px; }
        .step-desc { font-size:13.5px; color:var(--t2); line-height:1.6; font-weight:300; }
        .steps-visual { display:flex; justify-content:center; }
        .steps-card-mockup { background:var(--bg2); border:1px solid var(--b1); border-radius:16px; padding:24px; width:280px; box-shadow:0 24px 48px rgba(0,0,0,.4); }
        .scm-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--b1); }
        .scm-row:last-of-type { border-bottom:none; }
        .scm-file { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--t2); }
        .scm-size { font-family:'DM Mono',monospace; font-size:11px; color:var(--t3); }
        .scm-divider { height:1px; background:var(--b1); margin:12px 0; }
        .scm-ratio-row { display:flex; gap:6px; margin-bottom:16px; }
        .scm-ratio { flex:1; text-align:center; padding:6px 4px; border-radius:6px; font-size:11px; font-weight:600; background:var(--bg3); border:1px solid var(--b1); color:var(--t3); cursor:pointer; }
        .scm-ratio.active { background:rgba(74,222,128,.15); border-color:rgba(74,222,128,.4); color:var(--acc); }
        .scm-export-btn { background:var(--acc); color:#060e08; border-radius:8px; padding:10px; text-align:center; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px; }

        /* ── PRICING ── */
        .pricing-section { padding:100px 48px; text-align:center; position:relative; z-index:1; }
        .pricing-sub { font-size:16px; color:var(--t2); margin-bottom:52px; font-weight:300; }
        .pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; max-width:900px; margin:0 auto 24px; }
        .price-card { background:var(--bg2); border:1px solid var(--b1); border-radius:16px; padding:32px 28px; text-align:left; position:relative; transition:border-color .2s; }
        .price-card:hover { border-color:var(--b2); }
        .price-highlight { border-color:rgba(74,222,128,.35) !important; background:linear-gradient(135deg, #0d1f12 0%, #0a1a0e 100%); }
        .price-badge { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:var(--acc); color:#060e08; font-size:11px; font-weight:700; padding:3px 12px; border-radius:20px; white-space:nowrap; }
        .price-plan { font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--t3); margin-bottom:12px; }
        .price-amount { font-family:'Syne',sans-serif; font-size:36px; font-weight:800; display:flex; align-items:baseline; gap:3px; }
        .price-currency { font-size:20px; color:var(--t2); }
        .price-per { font-size:14px; color:var(--t3); font-weight:400; font-family:'DM Sans',sans-serif; }
        .price-inr { font-size:12px; color:var(--t3); font-family:'DM Mono',monospace; margin-bottom:12px; }
        .price-desc { font-size:13px; color:var(--t2); line-height:1.5; margin-bottom:20px; font-weight:300; }
        .price-divider { height:1px; background:var(--b1); margin-bottom:20px; }
        .price-features { list-style:none; display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }
        .price-features li { display:flex; align-items:center; gap:9px; font-size:13px; color:var(--t2); }
        .price-btn { width:100%; padding:11px; border-radius:8px; border:1px solid var(--b2); background:transparent; color:var(--t2); font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; }
        .price-btn:hover { background:rgba(255,255,255,.04); color:var(--t1); }
        .price-btn-highlight { background:var(--acc) !important; border-color:var(--acc) !important; color:#060e08 !important; }
        .price-btn-highlight:hover { background:var(--acc2) !important; }
        .pricing-note { font-size:12px; color:var(--t3); max-width:600px; margin:0 auto; line-height:1.6; }

        /* ── FOOTER ── */
        .land-footer { padding:48px; border-top:1px solid var(--b1); display:flex; align-items:center; justify-content:space-between; position:relative; z-index:1; }
        .footer-logo { display:flex; align-items:center; gap:10px; font-family:'Syne',sans-serif; font-size:18px; font-weight:700; }
        .footer-copy { font-size:13px; color:var(--t3); }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }

        @media (max-width: 900px) {
          .hero-section { grid-template-columns:1fr; padding:100px 24px 60px; }
          .hero-mockup { display:none; }
          .feat-grid { grid-template-columns:1fr 1fr; }
          .steps-layout { grid-template-columns:1fr; }
          .steps-visual { display:none; }
          .pricing-grid { grid-template-columns:1fr; }
          .land-nav { padding:16px 24px; }
          .land-footer { flex-direction:column; gap:12px; text-align:center; }
        }
      `}</style>
    </div>
  );
}