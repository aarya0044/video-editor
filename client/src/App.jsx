import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

/* ─── API URL ─────────────────────────────────────────────────────────────── */
const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000";

/* ─── AUDIO LIBRARY ───────────────────────────────────────────────────────── */
const _AUDIO_FILES = [
  { id: 1, name: "Chill Lofi Beat",     artist: "Pixabay", duration: 132, category: "Lofi",      color: "#3b82f6", file: "chill-lofi.mp3" },
  { id: 2, name: "Uplifting Corporate", artist: "Pixabay", duration: 120, category: "Upbeat",    color: "#10b981", file: "uplifting-corporate.mp3" },
  { id: 3, name: "Cinematic Ambient",   artist: "Pixabay", duration: 180, category: "Cinematic", color: "#8b5cf6", file: "cinematic-ambient.mp3" },
];
const AUDIO_LIBRARY = _AUDIO_FILES.map(t => ({
  ...t,
  url: `${API_URL}/audio/${t.file}`,
  src: `${API_URL}/audio/${t.file}`,
}));

/* ─── ICONS ───────────────────────────────────────────────────────────────── */
const Ic = ({ d, size = 16, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IcUpload   = () => <Ic d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />;
const IcMusic    = () => <Ic d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />;
const IcText     = () => <Ic d="M4 6h16M4 12h10M4 18h7" />;
const IcExport   = () => <Ic d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />;
const IcScissors = () => <Ic d="M6 3a3 3 0 0 1 0 6H3m3-6a3 3 0 0 0 0 6H3M6 3l12 12M6 9l12-12M17.01 21a3 3 0 0 1 0-6h3M17.01 21a3 3 0 0 0 0-6h3" />;
const IcTrash    = () => <Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={14} />;
const IcPlus     = () => <Ic d="M12 5v14M5 12h14" size={14} />;
const IcZoomIn   = () => <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-6-3v6m-3-3h6" size={14} />;
const IcZoomOut  = () => <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zm-3-3h-6" size={14} />;
const IcMove     = () => <Ic d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" size={14} />;
const IcEdit     = () => <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />;
const IcMaximize  = () => <Ic d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" size={14} />;
const IcMinimize  = () => <Ic d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" size={14} />;
const IcVolume    = () => <Ic d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" size={14} />;
const IcMute      = () => <Ic d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" size={14} />;
const IcLogout    = () => <Ic d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={14} />;

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fmt = (s) => { const m = Math.floor(s / 60); const sec = (s % 60).toFixed(2).padStart(5, "0"); return `${m}:${sec}`; };
const getVideoDuration = (url) => new Promise(res => {
  const v = document.createElement("video");
  v.preload = "metadata";
  v.onloadedmetadata = () => res(v.duration);
  v.onerror = () => res(5);
  v.src = url;
});

/* ─── POSITION MAP ────────────────────────────────────────────────────────── */
const POS_MAP = {
  "center":       { x: 50, y: 50 },
  "top-left":     { x: 10, y: 12 },
  "top-right":    { x: 90, y: 12 },
  "bottom-left":  { x: 10, y: 88 },
  "bottom-right": { x: 90, y: 88 },
};

/* ════════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const nav = useNavigate();

  const [mediaFiles,    setMediaFiles]    = useState([]);
  const [tracks,        setTracks]        = useState([
    { id: "video-1", type: "video", name: "Video", clips: [] },
    { id: "audio-1", type: "audio", name: "Audio", clips: [] },
    { id: "text-1",  type: "text",  name: "Text",  clips: [] },
  ]);
  const [uploading,     setUploading]     = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [exportRatio,   setExportRatio]   = useState("16:9");
  const [sidePanel,     setSidePanel]     = useState("media");
  const [showTextModal, setShowTextModal] = useState(false);
  const [editTextClip,  setEditTextClip]  = useState(null);
  const [playhead,      setPlayhead]      = useState(0);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [zoom,          setZoom]          = useState(1);
  const [selectedClip,  setSelectedClip]  = useState(null);
  const [resizing,      setResizing]      = useState(null);
  const [movingClip,    setMovingClip]    = useState(null);
  const [draggingText,  setDraggingText]  = useState(null);
  const [notification,  setNotification]  = useState(null);
  const [draggingFile,  setDraggingFile]  = useState(null);
  const [fullPreview,   setFullPreview]   = useState(false);
  const [user,          setUser]          = useState(null);
  const fullVideoRef = useRef(null);
  const [previewingAudio, setPreviewingAudio] = useState(null);
  const audioPreviewRef = useRef(null);

  const fileInputRef = useRef(null);
  const timelineRef  = useRef(null);
  const animRef      = useRef(null);
  const lastTimeRef  = useRef(null);
  const previewRef   = useRef(null);
  const videoEls     = useRef({});
  const exportIntervalRef = useRef(null);
  const audioRef = useRef(null);

  // ── Get current user ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav("/login");
  };

  /* derived */
  const pixelsPerSecond = 60 * zoom;
  const totalDuration = useMemo(() => {
    const vt = tracks.find(t => t.type === "video");
    if (!vt || !vt.clips.length) return 30;
    return Math.max(...vt.clips.map(c => c.end), 30);
  }, [tracks]);

  const currentVideoClip = useMemo(() => {
    const vt = tracks.find(t => t.type === "video");
    return vt?.clips.find(c => playhead >= c.start && playhead < c.end) ?? null;
  }, [tracks, playhead]);

  const activeTextClips = useMemo(() => {
    const tt = tracks.find(t => t.type === "text");
    return tt?.clips.filter(c => playhead >= c.start && playhead < c.end) ?? [];
  }, [tracks, playhead]);

  const selectedClipData = useMemo(() =>
    tracks.flatMap(t => t.clips).find(c => c.id === selectedClip) ?? null,
    [tracks, selectedClip]
  );

  /* ── NOTIFICATION ─────────────────────────────────────────────────────── */
  const showNotif = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  }, []);

  /* ── PLAYBACK ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const tick = (now) => {
        const dt = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        setPlayhead(p => {
          const next = p + dt;
          if (next >= totalDuration) { setIsPlaying(false); return 0; }
          return next;
        });
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, totalDuration]);

  /* ── AUDIO SYNC ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const at = tracks.find(t => t.type === "audio");
    const clip = at?.clips?.[0];
    if (!clip) {
      audioEl.pause();
      audioEl.src = "";
      return;
    }
    const clipSrc = clip.src || clip.url || "";
    if (clipSrc && audioEl.getAttribute("data-clip-src") !== clipSrc) {
      audioEl.src = clipSrc;
      audioEl.load();
      audioEl.setAttribute("data-clip-src", clipSrc);
    }
    audioEl.muted  = !!clip.muted;
    audioEl.volume = clip.volume ?? 1;
    const mediaOffset = clip.mediaOffset || 0;
    const localTime   = mediaOffset + (playhead - clip.start);
    if (playhead < clip.start || playhead >= clip.end) {
      if (!audioEl.paused) audioEl.pause();
      return;
    }
    if (Math.abs(audioEl.currentTime - localTime) > 0.3) {
      audioEl.currentTime = Math.max(0, localTime);
    }
    if (isPlaying && audioEl.paused)  audioEl.play().catch(() => {});
    if (!isPlaying && !audioEl.paused) audioEl.pause();
  }, [playhead, isPlaying, tracks]);

  /* ── VIDEO SYNC ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const vt = tracks.find(t => t.type === "video");
    if (!vt) return;
    const activeClip = vt.clips.find(c => playhead >= c.start && playhead < c.end);
    vt.clips.forEach(c => {
      const el   = videoEls.current[c.id];
      const fpEl = videoEls.current["fp-" + c.id];
      if (el   && !el.paused)   el.pause();
      if (fpEl && !fpEl.paused) fpEl.pause();
    });
    if (!activeClip) return;
    const elKey = fullPreview ? "fp-" + activeClip.id : activeClip.id;
    const el = videoEls.current[elKey];
    if (!el) return;
    const mediaOffset = activeClip.mediaOffset || 0;
    const localTime   = mediaOffset + (playhead - activeClip.start);
    if (Math.abs(el.currentTime - localTime) > 0.3) el.currentTime = localTime;
    if (isPlaying && el.paused)   el.play().catch(() => {});
    if (!isPlaying && !el.paused) el.pause();
  }, [playhead, isPlaying, tracks, fullPreview]);

  /* ── FILE UPLOAD ──────────────────────────────────────────────────────── */
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) {
      if (files[i] instanceof File) fd.append("files", files[i]);
    }
    setUploading(true);
    try {
      const res  = await fetch(`${API_URL}/api/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setMediaFiles(prev => [...prev, ...data.files.map(f => ({ ...f, id: uid() }))]);
        showNotif(`${data.files.length} file(s) uploaded`);
      } else showNotif(data.error || "Upload failed", "error");
    } catch { showNotif("Upload failed — is the backend running?", "error"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  /* ── ADD CLIP ─────────────────────────────────────────────────────────── */
  const addClipToTimeline = useCallback(async (file, startTime = null, trackType = "video") => {
    let duration = 5;
    if (file.type?.includes("video")) {
      try {
        duration = await getVideoDuration(file.url);
        if (duration > 300) {
          showNotif(`⚠️ "${file.name}" is ${Math.round(duration/60)} min long — trim it in the timeline to under 5 min before exporting`, "error");
        }
      } catch {}
    }
    const track = tracks.find(t => t.type === trackType);
    const insertAt = startTime ?? (track?.clips.length ? Math.max(...track.clips.map(c => c.end)) : 0);
    const newClip = {
      id: uid(), name: file.name, src: file.url,
      type: file.type || "video/mp4",
      start: Math.max(0, insertAt), end: Math.max(0, insertAt) + duration,
      duration, mediaOffset: 0, muted: false, volume: 1.0,
    };
    setTracks(prev => prev.map(t =>
      t.type === trackType
        ? { ...t, clips: [...t.clips, newClip].sort((a, b) => a.start - b.start) }
        : t
    ));
    showNotif(`Added "${file.name}"`);
  }, [tracks, showNotif]);

  /* ── REMOVE CLIP ──────────────────────────────────────────────────────── */
  const removeClip = (clipId) => {
    setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })));
    setSelectedClip(null);
  };

  /* ── TOGGLE MUTE ─────────────────────────────────────────────────────── */
  const toggleMuteClip = (clipId) => {
    setTracks(prev => prev.map(t => ({
      ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, muted: !c.muted } : c)
    })));
  };

  /* ── UPDATE CLIP ──────────────────────────────────────────────────────── */
  const updateClip = useCallback((clipId, fields) => {
    setTracks(prev => prev.map(t => ({
      ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, ...fields } : c)
    })));
  }, []);

  /* ── SPLIT ────────────────────────────────────────────────────────────── */
  const splitAtPlayhead = () => {
    const vt = tracks.find(t => t.type === "video");
    if (!vt) return;
    const clip = vt.clips.find(c => playhead > c.start + 0.05 && playhead < c.end - 0.05);
    if (!clip) { showNotif("Place playhead over a clip to split", "error"); return; }
    const splitOffset = playhead - clip.start;
    const left  = { ...clip, end: playhead };
    const right = { ...clip, id: uid(), start: playhead, mediaOffset: (clip.mediaOffset || 0) + splitOffset };
    setTracks(prev => prev.map(t =>
      t.id !== vt.id ? t : {
        ...t, clips: [...t.clips.filter(c => c.id !== clip.id), left, right].sort((a, b) => a.start - b.start)
      }
    ));
    showNotif("Clip split");
  };

  /* ── RESIZE ───────────────────────────────────────────────────────────── */
  const startResize = (e, clip, edge, trackId) => {
    e.stopPropagation(); e.preventDefault();
    setResizing({ clipId: clip.id, edge, startX: e.clientX, startStart: clip.start, startEnd: clip.end, trackId, maxDur: clip.duration });
  };
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dt = (e.clientX - resizing.startX) / pixelsPerSecond;
      setTracks(prev => prev.map(t => {
        if (t.id !== resizing.trackId) return t;
        return { ...t, clips: t.clips.map(c => {
          if (c.id !== resizing.clipId) return c;
          if (resizing.edge === "left") {
            const ns = Math.max(0, Math.min(resizing.startStart + dt, c.end - 0.1));
            return { ...c, start: ns };
          } else {
            const cap = resizing.maxDur ? c.start + resizing.maxDur : 999999;
            const ne  = Math.min(cap, Math.max(c.start + 0.1, resizing.startEnd + dt));
            return { ...c, end: ne };
          }
        })};
      }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [resizing, pixelsPerSecond]);

  /* ── MOVE CLIP ────────────────────────────────────────────────────────── */
  const startMoveClip = (e, clip, trackId) => {
    if (resizing) return;
    e.preventDefault();
    setMovingClip({ clipId: clip.id, trackId, startX: e.clientX, origStart: clip.start, origEnd: clip.end });
    setSelectedClip(clip.id);
  };
  useEffect(() => {
    if (!movingClip) return;
    const onMove = (e) => {
      const dt  = (e.clientX - movingClip.startX) / pixelsPerSecond;
      const dur = movingClip.origEnd - movingClip.origStart;
      const ns  = Math.max(0, movingClip.origStart + dt);
      setTracks(prev => prev.map(t => {
        if (t.id !== movingClip.trackId) return t;
        return { ...t, clips: t.clips.map(c =>
          c.id !== movingClip.clipId ? c : { ...c, start: ns, end: ns + dur }
        ).sort((a, b) => a.start - b.start) };
      }));
    };
    const onUp = () => setMovingClip(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [movingClip, pixelsPerSecond]);

  /* ── DRAG TEXT ON PREVIEW ─────────────────────────────────────────────── */
  const startDragText = (e, clip) => {
    e.stopPropagation();
    if (!previewRef.current) return;
    const rect    = previewRef.current.getBoundingClientRect();
    const startPx = clip.textOverlay?.px ?? (POS_MAP[clip.textOverlay?.position || "center"]?.x ?? 50);
    const startPy = clip.textOverlay?.py ?? (POS_MAP[clip.textOverlay?.position || "center"]?.y ?? 50);
    setDraggingText({ clipId: clip.id, startX: e.clientX, startY: e.clientY, startPx, startPy, rect });
  };
  useEffect(() => {
    if (!draggingText) return;
    const onMove = (e) => {
      const dx = ((e.clientX - draggingText.startX) / draggingText.rect.width)  * 100;
      const dy = ((e.clientY - draggingText.startY) / draggingText.rect.height) * 100;
      const px = Math.max(2, Math.min(98, draggingText.startPx + dx));
      const py = Math.max(2, Math.min(98, draggingText.startPy + dy));
      const clip = tracks.flatMap(t => t.clips).find(c => c.id === draggingText.clipId);
      if (!clip) return;
      updateClip(draggingText.clipId, { textOverlay: { ...clip.textOverlay, px, py, position: "custom" } });
    };
    const onUp = () => setDraggingText(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [draggingText, tracks, updateClip]);

  /* ── RULER CLICK ──────────────────────────────────────────────────────── */
  const handleRulerClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPlayhead(Math.max(0, Math.min((e.clientX - rect.left) / pixelsPerSecond, totalDuration)));
  };

  /* ── DROP FROM SIDEBAR ────────────────────────────────────────────────── */
  const handleDrop = async (e, trackType) => {
    e.preventDefault();
    if (!draggingFile) return;
    const rect     = e.currentTarget.getBoundingClientRect();
    const dropTime = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
    await addClipToTimeline(draggingFile, dropTime, trackType);
    setDraggingFile(null);
  };

  /* ── ADD AUDIO FROM LIBRARY ───────────────────────────────────────────── */
  const addAudioFromLibrary = (audio) => {
    const at = tracks.find(t => t.type === "audio");
    const insertAt = at?.clips.length ? Math.max(...at.clips.map(c => c.end)) : 0;
    const clip = {
      id: uid(), name: audio.name,
      src: audio.url,
      type: "audio/mpeg",
      start: insertAt, end: insertAt + audio.duration,
      duration: audio.duration, mediaOffset: 0, muted: false, volume: 1.0,
    };
    setTracks(prev => prev.map(t =>
      t.type === "audio"
        ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
        : t
    ));
    showNotif(`Added "${audio.name}" to Audio track`);
  };

  /* ── ADD / EDIT TEXT ──────────────────────────────────────────────────── */
  const submitTextClip = (e) => {
    e.preventDefault();
    const fd        = new FormData(e.target);
    const text      = fd.get("text");
    const fontSize  = parseInt(fd.get("fontSize")) || 32;
    const fontColor = fd.get("fontColor") || "#ffffff";
    const position  = fd.get("position") || "center";
    const startPos  = POS_MAP[position] || POS_MAP["center"];
    if (editTextClip) {
      updateClip(editTextClip.id, {
        name: text.slice(0, 24) || "Text",
        textOverlay: { ...editTextClip.textOverlay, text, fontSize, fontColor, position,
          px: editTextClip.textOverlay?.px ?? startPos.x,
          py: editTextClip.textOverlay?.py ?? startPos.y,
        }
      });
      showNotif("Text updated");
    } else {
      const tt = tracks.find(t => t.type === "text");
      const insertAt = tt?.clips.length ? Math.max(...tt.clips.map(c => c.end)) : 0;
      const clip = {
        id: uid(), name: text.slice(0, 24) || "Text", type: "text",
        start: insertAt, end: insertAt + 4, duration: 4,
        textOverlay: { enabled: true, text, fontSize, fontColor, position, px: startPos.x, py: startPos.y }
      };
      setTracks(prev => prev.map(t =>
        t.type === "text" ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) } : t
      ));
      showNotif("Text overlay added");
    }
    setShowTextModal(false);
    setEditTextClip(null);
  };

  /* ── EXPORT ───────────────────────────────────────────────────────────── */
  const handleExport = async () => {
    const vt = tracks.find(t => t.type === "video");
    if (!vt?.clips.length) { showNotif("Add video clips first", "error"); return; }
    setExporting(true);

    // ── Track export in Supabase ──────────────────────────────────────────
    let exportRowId = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from("exports").insert({
          user_id:    session.user.id,
          status:     "processing",
          ratio:      exportRatio,
          created_at: new Date().toISOString(),
        }).select().single();
        if (data) exportRowId = data.id;
      }
    } catch (e) { console.warn("Supabase export tracking error:", e); }

    // helper to update the row status
    const updateExportRow = async (status) => {
      if (!exportRowId) return;
      try {
        await supabase.from("exports").update({
          status,
          completed_at: new Date().toISOString(),
        }).eq("id", exportRowId);
      } catch (e) { console.warn("Supabase update error:", e); }
    };

    try {
      const cleanTracks = JSON.parse(JSON.stringify(tracks));
      const response = await fetch(`${API_URL}/api/export-video`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: cleanTracks, projectName: `project_${Date.now()}`, ratio: exportRatio }),
      });
      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try {
          const d = await response.json();
          msg = d.error || msg;
          if (response.status === 429) {
            showNotif("⏳ Server is busy with another export. Please wait a moment and try again.", "error");
            setExporting(false);
            await updateExportRow("failed");
            return;
          }
        } catch {}
        throw new Error(msg);
      }
      const d = await response.json();
      const taskId = d?.taskId;
      if (!taskId) throw new Error(d?.error || "No task ID returned from server");
      showNotif("Export started — processing in background…");
      let attempts = 0;
      const maxAttempts = 300;
      exportIntervalRef.current = setInterval(async () => {
        attempts += 1;
        fetch(`${API_URL}/api/health`).catch(() => {});
        try {
          const statusRes  = await fetch(`${API_URL}/api/status/${taskId}`);
          if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.status}`);
          const statusData = await statusRes.json();
          if (statusData.status === "success") {
            clearInterval(exportIntervalRef.current);
            exportIntervalRef.current = null;
            setExporting(false);
            await updateExportRow("success");
            const downloadUrl = statusData.outputUrl.startsWith("http")
              ? statusData.outputUrl : `${API_URL}${statusData.outputUrl}`;
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = downloadUrl.split("/").pop() || "export.mp4";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showNotif("✅ Export complete — downloading!");
          } else if (statusData.status === "cancelled") {
            clearInterval(exportIntervalRef.current);
            exportIntervalRef.current = null;
            setExporting(false);
            await updateExportRow("cancelled");
            showNotif("Export cancelled", "error");
          } else if (statusData.status === "failed") {
            clearInterval(exportIntervalRef.current);
            exportIntervalRef.current = null;
            setExporting(false);
            await updateExportRow("failed");
            showNotif("Export failed — check console for details", "error");
          } else if (attempts >= maxAttempts) {
            clearInterval(exportIntervalRef.current);
            exportIntervalRef.current = null;
            setExporting(false);
            await updateExportRow("failed");
            showNotif("Export timed out — try again", "error");
          }
        } catch (err) {
          clearInterval(exportIntervalRef.current);
          exportIntervalRef.current = null;
          setExporting(false);
          await updateExportRow("failed");
          showNotif(`Export failed: ${err.message}`, "error");
        }
      }, 3000);
    } catch (err) {
      showNotif(`Export failed: ${err.message}`, "error");
      setExporting(false);
      await updateExportRow("failed");
    }
  };

  /* ── CANCEL EXPORT ───────────────────────────────────────────────────── */
  const handleCancelExport = async () => {
    setCancelling(true);
    try {
      await fetch(`${API_URL}/api/cancel-export`, { method: "POST" });
      if (exportIntervalRef.current) {
        clearInterval(exportIntervalRef.current);
        exportIntervalRef.current = null;
      }
      setExporting(false);
      showNotif("Export cancelled", "error");
    } catch {
      showNotif("Could not reach server to cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  /* ── RULER TICKS ──────────────────────────────────────────────────────── */
  const step = zoom < 0.5 ? 5 : zoom < 1 ? 2 : 1;
  const rulerTicks = [];
  for (let i = 0; i <= Math.ceil(totalDuration) + 1; i += step) rulerTicks.push(i);
  const timelineWidth = totalDuration * pixelsPerSecond;

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>
      <audio ref={audioRef} preload="auto" style={{ display: "none" }} />

      <div className="shell">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" fill="#37e584"/>
              <path d="M9 8l7 4-7 4V8z" fill="#0a1f12"/>
            </svg>
            Edit<span>Flow</span>
          </div>
          <div className="divider" />
          <button className="tbtn" onClick={splitAtPlayhead}><IcScissors /> Split</button>
          <button className="tbtn danger" onClick={() => selectedClip ? removeClip(selectedClip) : showNotif("Select a clip first","error")}>
            <IcTrash /> Delete
          </button>
          <div className="timecode">{fmt(playhead)}</div>

          {/* RATIO SELECTOR */}
          <div className="ratio-group">
            {[
              { label: "16:9", title: "Landscape — YouTube, Desktop" },
              { label: "9:16", title: "Vertical — Reels, TikTok, Shorts" },
              { label: "1:1",  title: "Square — Instagram Post" },
              { label: "4:5",  title: "Portrait — Instagram Portrait" },
            ].map(r => (
              <button
                key={r.label}
                className={`ratio-btn${exportRatio === r.label ? " active" : ""}`}
                onClick={() => setExportRatio(r.label)}
                title={r.title}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button className="tbtn export-btn" onClick={handleExport} disabled={exporting}>
            <IcExport /> {exporting ? "Exporting…" : "Export Video"}
          </button>
          {exporting && (
            <button className="tbtn cancel-btn" onClick={handleCancelExport} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "✕ Cancel"}
            </button>
          )}

          {/* USER + LOGOUT */}
          <div className="user-area">
            {user && (
              <div className="user-avatar" title={user.email}>
                {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <button className="tbtn logout-btn" onClick={handleLogout} title="Sign out">
              <IcLogout /> Sign out
            </button>
          </div>
        </header>

        {/* MAIN AREA */}
        <div className="main">

          {/* LEFT SIDEBAR */}
          <aside className="sidebar">
            <div className="stabs">
              {[["media","Media",<IcUpload key="u"/>],["audio","Music",<IcMusic key="m"/>],["text","Text",<IcText key="t"/>]].map(([k,label,icon])=>(
                <button key={k} className={`stab${sidePanel===k?" active":""}`} onClick={()=>setSidePanel(k)}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
            <div className="scontent">

              {sidePanel === "media" && <>
                <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
                  <div className="uicon"><IcUpload /></div>
                  <div className="utext">{uploading ? "Uploading…" : "Upload Media"}</div>
                  <div className="usub">Video, image or audio files</div>
                </div>
                <input type="file" ref={fileInputRef} multiple accept="video/*,image/*,audio/*" onChange={handleFileUpload} hidden />
                {mediaFiles.length > 0 && <>
                  <div className="sec-label">Your Media</div>
                  {mediaFiles.map(f => (
                    <div key={f.id} className="mitem" draggable onDragStart={() => setDraggingFile(f)}>
                      <div className="mthumb">
                        {f.type?.includes("video") ? <video src={f.url} muted preload="metadata" />
                         : f.type?.includes("image") ? <img src={f.url} alt={f.name} />
                         : <span style={{fontSize:16,color:"var(--green)"}}>♪</span>}
                      </div>
                      <div className="minfo">
                        <div className="mname">{f.name}</div>
                        <div className="mmeta">{f.type?.split("/")[0]}</div>
                      </div>
                      <button className="madd" onClick={() => addClipToTimeline(f)}>+</button>
                    </div>
                  ))}
                </>}
              </>}

              {sidePanel === "audio" && <>
                <div className="sec-label">Music Library</div>
                <p style={{fontSize:10,color:"var(--t3)",marginBottom:10,lineHeight:1.5}}>
                  Click ▶ to preview · Click track name to add to timeline
                </p>
                <audio ref={audioPreviewRef} style={{display:"none"}} onEnded={() => setPreviewingAudio(null)} />
                {AUDIO_LIBRARY.map(a => {
                  const isPreviewing = previewingAudio === a.id;
                  return (
                    <div key={a.id} className="aitem-v2" style={{"--acolor": a.color}}>
                      <button
                        className="audio-play-btn"
                        style={{background: a.color}}
                        onClick={() => {
                          const el = audioPreviewRef.current;
                          if (!el) return;
                          if (isPreviewing) {
                            el.pause();
                            setPreviewingAudio(null);
                          } else {
                            el.src = a.url;
                            el.play().catch(() => showNotif("Audio file not found — add mp3s to server/public/audio/", "error"));
                            setPreviewingAudio(a.id);
                          }
                        }}
                      >
                        {isPreviewing
                          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
                        }
                      </button>
                      <div className="audio-info" onClick={() => addAudioFromLibrary(a)} title="Click to add to timeline">
                        <div className="aname">{a.name}</div>
                        <div className="ameta">{a.category} · {Math.floor(a.duration/60)}:{String(a.duration%60).padStart(2,"0")}</div>
                        {isPreviewing && <div className="audio-playing-bar">
                          {[...Array(16)].map((_,i) => <div key={i} className="audio-bar" style={{animationDelay:`${i*0.07}s`}} />)}
                        </div>}
                      </div>
                      <button className="madd" onClick={() => addAudioFromLibrary(a)} title="Add to Audio track">+</button>
                    </div>
                  );
                })}
              </>}

              {sidePanel === "text" && <>
                <button className="text-add-btn" onClick={() => { setEditTextClip(null); setShowTextModal(true); }}>
                  <IcPlus /> Add Text Overlay
                </button>
                <div className="sec-label" style={{marginTop:12}}>Text Clips</div>
                {tracks.find(t=>t.type==="text")?.clips.length === 0 && (
                  <div style={{fontSize:11,color:"var(--t3)",textAlign:"center",padding:"16px 0"}}>No text clips yet</div>
                )}
                {tracks.find(t=>t.type==="text")?.clips.map(c => (
                  <div key={c.id} className="mitem" onClick={() => setSelectedClip(c.id)}>
                    <div style={{fontSize:18,color:"var(--orange)",width:36,textAlign:"center",flexShrink:0,fontWeight:700}}>T</div>
                    <div className="minfo">
                      <div className="mname">{c.textOverlay?.text}</div>
                      <div className="mmeta">{c.start.toFixed(1)}s – {c.end.toFixed(1)}s</div>
                    </div>
                    <button className="madd" onClick={e => { e.stopPropagation(); setEditTextClip(c); setShowTextModal(true); }}>
                      <IcEdit />
                    </button>
                  </div>
                ))}
              </>}
            </div>
          </aside>

          {/* PREVIEW */}
          <main className="preview-center">
            <div className="preview-wrap">
            <div
              className="preview-canvas"
              ref={previewRef}
              style={{
                aspectRatio: exportRatio === "9:16" ? "9/16"
                           : exportRatio === "1:1"  ? "1/1"
                           : exportRatio === "4:5"  ? "4/5"
                           : "16/9"
              }}
            >
                {currentVideoClip ? (
                  currentVideoClip.type?.includes("image") ? (
                    <img src={currentVideoClip.src} alt={currentVideoClip.name}
                      style={{width:"100%",height:"100%",objectFit: exportRatio === "16:9" ? "contain" : "cover",display:"block"}} />
                  ) : (
                    <video
                      key={currentVideoClip.id}
                      ref={el => { if (el) videoEls.current[currentVideoClip.id] = el; }}
                      src={currentVideoClip.src}
                      style={{width:"100%",height:"100%",objectFit: exportRatio === "16:9" ? "contain" : "cover",display:"block"}}
                      playsInline muted={!!currentVideoClip.muted}
                    />
                  )
                ) : (
                  <div className="preview-empty">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity:.15,marginBottom:8}}>
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                    <p>Upload media and add clips to the timeline</p>
                  </div>
                )}

                {activeTextClips.map(tc => {
                  const ov = tc.textOverlay;
                  if (!ov?.text) return null;
                  const px = ov.px ?? POS_MAP[ov.position || "center"]?.x ?? 50;
                  const py = ov.py ?? POS_MAP[ov.position || "center"]?.y ?? 50;
                  return (
                    <div key={tc.id}
                      className={`preview-text${selectedClip===tc.id?" sel-text":""}`}
                      style={{ left:`${px}%`, top:`${py}%`, fontSize: ov.fontSize || 32, color: ov.fontColor || "#fff" }}
                      onMouseDown={e => { setSelectedClip(tc.id); startDragText(e, tc); }}
                      title="Drag to reposition">
                      {ov.text}
                      <div className="text-move-hint"><IcMove /></div>
                    </div>
                  );
                })}

                <div className="canvas-controls">
                  <button className="canvas-skip" onClick={() => { setPlayhead(0); setIsPlaying(false); }} title="Restart">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                  </button>
                  <button className="canvas-play" onClick={() => setIsPlaying(p => !p)}>
                    {isPlaying
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
                    }
                  </button>
                  <button className="canvas-skip" onClick={() => { setPlayhead(totalDuration); setIsPlaying(false); }} title="End">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6z"/></svg>
                  </button>
                </div>

                <div className="canvas-progress-bg" onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setPlayhead((e.clientX - r.left) / r.width * totalDuration);
                }}>
                  <div className="canvas-progress-fill" style={{width:`${(playhead/totalDuration)*100}%`}} />
                </div>

                <div className="preview-tc">{fmt(playhead)}</div>
              </div>

              <div className="preview-bar">
                <span className="preview-bar-time">{fmt(playhead)}</span>
                <input type="range" className="preview-scrubber"
                  min={0} max={totalDuration} step={0.05} value={playhead}
                  onChange={e => { setIsPlaying(false); setPlayhead(parseFloat(e.target.value)); }}
                />
                <span className="preview-bar-time">{fmt(totalDuration)}</span>
                <button className="preview-fullbtn"
                  onClick={() => { setIsPlaying(false); setPlayhead(0); setFullPreview(true); }}
                  title="Full-screen preview">
                  <IcMaximize /> Full Preview
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT PANEL */}
          <aside className="right-panel">
            <div className="panel-hdr">Properties</div>
            <div className="panel-body">
              {selectedClipData ? (
                <>
                  <div className="prop-label">Name</div>
                  <div className="prop-val">{selectedClipData.name}</div>
                  <div className="prop-label">Type</div>
                  <div className="prop-val">{selectedClipData.type}</div>
                  <div className="prop-label">Timing</div>
                  <div className="prop-row">
                    <div className="prop-col">
                      <div className="prop-sublabel">Start</div>
                      <input className="prop-input" type="number" step="0.1" min="0"
                        value={+selectedClipData.start.toFixed(2)}
                        onChange={e => {
                          const ns  = Math.max(0, parseFloat(e.target.value) || 0);
                          const dur = selectedClipData.end - selectedClipData.start;
                          updateClip(selectedClipData.id, { start: ns, end: ns + dur });
                        }}
                      />
                    </div>
                    <div className="prop-col">
                      <div className="prop-sublabel">End</div>
                      <input className="prop-input" type="number" step="0.1"
                        value={+selectedClipData.end.toFixed(2)}
                        onChange={e => {
                          const ne = parseFloat(e.target.value) || 0;
                          if (ne > selectedClipData.start) updateClip(selectedClipData.id, { end: ne });
                        }}
                      />
                    </div>
                  </div>
                  <div className="prop-label">Duration</div>
                  <div className="prop-val">{(selectedClipData.end - selectedClipData.start).toFixed(2)}s</div>

                  {selectedClipData.textOverlay?.enabled && <>
                    <div className="prop-label">Text Content</div>
                    <input className="prop-input" style={{width:"100%"}}
                      key={selectedClipData.id + "-text"}
                      defaultValue={selectedClipData.textOverlay.text}
                      onBlur={e => updateClip(selectedClipData.id, {
                        textOverlay: { ...selectedClipData.textOverlay, text: e.target.value }
                      })}
                    />
                    <div className="prop-label">Font Size</div>
                    <input className="prop-input" type="number" style={{width:"100%"}}
                      value={selectedClipData.textOverlay.fontSize}
                      onChange={e => updateClip(selectedClipData.id, {
                        textOverlay: { ...selectedClipData.textOverlay, fontSize: parseInt(e.target.value) || 32 }
                      })}
                    />
                    <div className="prop-label">Color</div>
                    <input type="color" className="prop-input" style={{width:"100%",height:34,padding:"2px 4px"}}
                      value={selectedClipData.textOverlay.fontColor}
                      onChange={e => updateClip(selectedClipData.id, {
                        textOverlay: { ...selectedClipData.textOverlay, fontColor: e.target.value }
                      })}
                    />
                    <div className="prop-label">Position</div>
                    <div className="prop-val" style={{fontSize:10,color:"var(--t3)"}}>
                      {selectedClipData.textOverlay.position === "custom"
                        ? `Custom (${Math.round(selectedClipData.textOverlay.px||50)}%, ${Math.round(selectedClipData.textOverlay.py||50)}%)`
                        : selectedClipData.textOverlay.position}
                      <span style={{display:"block",marginTop:3,color:"var(--t3)"}}>Drag text on preview to move</span>
                    </div>
                    <button className="tbtn" style={{width:"100%",marginTop:8,justifyContent:"center"}}
                      onClick={() => { setEditTextClip(selectedClipData); setShowTextModal(true); }}>
                      <IcEdit /> Edit in Dialog
                    </button>
                  </>}

                  {selectedClipData.type?.includes('video') && (
                    <button
                      className={`mute-btn${selectedClipData.muted ? " muted" : ""}`}
                      onClick={() => toggleMuteClip(selectedClipData.id)}
                    >
                      {selectedClipData.muted ? <><IcMute /> Unmute Original Audio</> : <><IcVolume /> Mute Original Audio</>}
                    </button>
                  )}

                  {!selectedClipData.muted && (
                    <>
                      <div className="prop-label">Volume</div>
                      <input type="range" min="0" max="1" step="0.05"
                        value={selectedClipData.volume ?? 1}
                        onChange={e => updateClip(selectedClipData.id, { volume: parseFloat(e.target.value) })}
                      />
                    </>
                  )}

                  <button className="del-btn" onClick={() => removeClip(selectedClipData.id)}>
                    <IcTrash /> Remove Clip
                  </button>

                  {selectedClipData.type === "audio/mpeg" && (
                    <>
                      <div className="prop-label">Background Audio</div>
                      <button
                        className={`mute-btn${selectedClipData.muted ? " muted" : ""}`}
                        onClick={() => updateClip(selectedClipData.id, { muted: !selectedClipData.muted })}
                      >
                        {selectedClipData.muted ? <><IcMute /> Unmute Music</> : <><IcVolume /> Mute Music</>}
                      </button>
                      {!selectedClipData.muted && (
                        <>
                          <div className="prop-label">Music Volume</div>
                          <input type="range" min="0" max="1" step="0.05"
                            value={selectedClipData.volume ?? 1}
                            onChange={e => updateClip(selectedClipData.id, { volume: parseFloat(e.target.value) })}
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="no-sel">
                  <div style={{fontSize:34,opacity:.12,marginBottom:6}}>◧</div>
                  <p>Click any clip to view &amp; edit its properties</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* TIMELINE */}
        <section className="tl-section">
          <div className="tl-toolbar">
            <button className="tl-btn" onClick={splitAtPlayhead}><IcScissors /> Split at Playhead</button>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
              <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.2, z-0.25))}><IcZoomOut /></button>
              <span className="zoom-lbl">{Math.round(zoom*100)}%</span>
              <button className="zoom-btn" onClick={() => setZoom(z => Math.min(5, z+0.25))}><IcZoomIn /></button>
            </div>
          </div>
          <div className="tl-scroll" ref={timelineRef}>
            <div className="tl-inner" style={{width: Math.max(timelineWidth + 100, 800)}}>
              <div className="ruler-row">
                <div className="track-lbl-spacer" />
                <div className="ruler-ticks" style={{width: timelineWidth}} onClick={handleRulerClick}>
                  <div className="ph-line" style={{left: playhead * pixelsPerSecond}}><div className="ph-head" /></div>
                  {rulerTicks.map(t => (
                    <div key={t} className="r-tick" style={{left: t * pixelsPerSecond}}>
                      <div className="r-tick-line" /><div className="r-tick-lbl">{t}s</div>
                    </div>
                  ))}
                </div>
              </div>
              {tracks.map(track => {
                const color = track.type === "video" ? "#3b82f6" : track.type === "audio" ? "#10b981" : "#f59e0b";
                return (
                  <div key={track.id} className="track-row">
                    <div className="track-lbl" style={{color}}>{track.name}</div>
                    <div className="track-content" style={{width: timelineWidth}}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleDrop(e, track.type)}
                      onClick={handleRulerClick}
                    >
                      <div className="ph-line" style={{left: playhead * pixelsPerSecond}} />
                      {track.clips.length === 0 && (
                        <div className="empty-track">Drop clips here or use + button</div>
                      )}
                      {track.clips.map(clip => {
                        const left  = clip.start * pixelsPerSecond;
                        const width = Math.max((clip.end - clip.start) * pixelsPerSecond, 24);
                        const bg = track.type === "video"
                          ? clip.type?.includes("image")
                            ? "linear-gradient(135deg,#5b21b6,#8b5cf6)"
                            : "linear-gradient(135deg,#1d4ed8,#3b82f6)"
                          : track.type === "audio"
                            ? "linear-gradient(135deg,#065f46,#10b981)"
                            : "linear-gradient(135deg,#92400e,#f59e0b)";
                        const isSel = selectedClip === clip.id;
                        return (
                          <div key={clip.id}
                            className={`tl-clip${isSel?" sel":""}`}
                            style={{ left, width, background: bg }}
                            onMouseDown={e => startMoveClip(e, clip, track.id)}
                            onClick={e => { e.stopPropagation(); setSelectedClip(clip.id); }}
                          >
                            <div className="rh rh-l" onMouseDown={e => { e.stopPropagation(); startResize(e, clip, "left", track.id); }} />
                            <div className="clip-inner">
                              {track.type === "audio" && <div className="waveform" />}
                              {track.type === "video" && clip.type?.includes("image") && (
                                <img src={clip.src} alt="" className="clip-thumb" />
                              )}
                              <span className="clip-nm">{clip.name}</span>
                              {clip.muted && <span className="clip-mute-badge" title="Audio muted"><IcMute /></span>}
                            </div>
                            <div className="rh rh-r" onMouseDown={e => { e.stopPropagation(); startResize(e, clip, "right", track.id); }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* FULL PREVIEW MODAL */}
      {fullPreview && (
        <div className="fp-overlay" onClick={() => { setIsPlaying(false); setFullPreview(false); }}>
          <button className="fp-back-btn" onClick={() => { setIsPlaying(false); setFullPreview(false); }} title="Back to editor">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Back to Editor
          </button>
          <div className="fp-box" onClick={e => e.stopPropagation()}>
            <div className="fp-header">
              <span className="fp-title">{fmt(playhead)} / {fmt(totalDuration)}</span>
              <button className="fp-ctrl-sm" onClick={() => { setPlayhead(0); setIsPlaying(false); }} title="Restart">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
              </button>
            </div>
            <div className="fp-canvas" onClick={() => setIsPlaying(p => !p)} style={{cursor:"pointer"}}>
              <div className="fp-play-overlay" style={{opacity: isPlaying ? 0 : 1}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
              </div>
              {currentVideoClip ? (
                currentVideoClip.type?.includes("image") ? (
                  <img src={currentVideoClip.src} style={{width:"100%",height:"100%",objectFit: exportRatio === "16:9" ? "contain" : "cover"}} alt="" />
                ) : (
                  <video
                    key={"fp-" + currentVideoClip.id}
                    ref={el => { if (el) { videoEls.current["fp-" + currentVideoClip.id] = el; fullVideoRef.current = el; } }}
                    src={currentVideoClip.src}
                    style={{width:"100%",height:"100%",objectFit: exportRatio === "16:9" ? "contain" : "cover"}}
                    playsInline muted={currentVideoClip.muted}
                  />
                )
              ) : (
                <div style={{color:"var(--t3)",textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:8}}>▶</div>
                  <p>No video at this position</p>
                </div>
              )}
              {activeTextClips.map(tc => {
                const ov = tc.textOverlay;
                if (!ov?.text) return null;
                const px = ov.px ?? (POS_MAP[ov.position || "center"]?.x ?? 50);
                const py = ov.py ?? (POS_MAP[ov.position || "center"]?.y ?? 50);
                return (
                  <div key={tc.id} style={{
                    position:"absolute", left:`${px}%`, top:`${py}%`,
                    transform:"translate(-50%,-50%)", fontSize: (ov.fontSize || 32) * 1.4,
                    color: ov.fontColor || "#fff", fontWeight:700,
                    textShadow:"0 2px 12px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,.8)",
                    pointerEvents:"none", padding:"4px 12px",
                    background:"rgba(0,0,0,.4)", borderRadius:4, whiteSpace:"nowrap"
                  }}>
                    {ov.text}
                  </div>
                );
              })}
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"rgba(255,255,255,.1)"}}>
                <div style={{height:"100%",background:"var(--acc)",width:`${(playhead/totalDuration)*100}%`,transition:"width .1s linear"}} />
              </div>
              <div style={{position:"absolute",top:10,right:12,background:"rgba(0,0,0,.8)",padding:"3px 10px",borderRadius:5,fontSize:12,fontFamily:"'DM Mono',monospace",color:"#fff"}}>
                {fmt(playhead)}
              </div>
            </div>
            <div style={{padding:"8px 16px 12px"}}>
              <input type="range" min={0} max={totalDuration} step={0.05} value={playhead}
                onChange={e => { setIsPlaying(false); setPlayhead(parseFloat(e.target.value)); }}
                style={{width:"100%",accentColor:"var(--acc)",cursor:"pointer"}}
              />
            </div>
          </div>
        </div>
      )}

      {/* TEXT MODAL */}
      {showTextModal && (
        <div className="modal-bg" onClick={() => { setShowTextModal(false); setEditTextClip(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editTextClip ? "Edit Text Overlay" : "Add Text Overlay"}</div>
            <form onSubmit={submitTextClip}>
              <label className="modal-lbl">Text</label>
              <input name="text" className="modal-inp" placeholder="Your text here…" required autoFocus
                defaultValue={editTextClip?.textOverlay?.text || ""} />
              <label className="modal-lbl">Font Size</label>
              <input name="fontSize" type="number" className="modal-inp" min={10} max={120}
                defaultValue={editTextClip?.textOverlay?.fontSize || 36} />
              <label className="modal-lbl">Color</label>
              <input name="fontColor" type="color" className="modal-inp" style={{height:38,padding:"2px 6px"}}
                defaultValue={editTextClip?.textOverlay?.fontColor || "#ffffff"} />
              <label className="modal-lbl">Starting Position</label>
              <select name="position" className="modal-inp"
                defaultValue={editTextClip?.textOverlay?.position !== "custom" ? editTextClip?.textOverlay?.position || "center" : "center"}>
                <option value="center">Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
              <div className="modal-hint">💡 After adding, drag the text on the preview canvas to place it exactly where you want.</div>
              <div className="modal-btns">
                <button type="button" className="modal-cancel" onClick={() => { setShowTextModal(false); setEditTextClip(null); }}>Cancel</button>
                <button type="submit" className="modal-submit">{editTextClip ? "Update" : "Add Overlay"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTIFICATION */}
      {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
    </>
  );
}

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#141414;--s1:#1c1c1c;--s2:#222;--s3:#2a2a2a;
  --b1:#2e2e2e;--b2:#3a3a3a;
  --t1:#f0f0f0;--t2:#9a9a9a;--t3:#555;
  --acc:#37e584;--acc2:#2dc96f;
  --blue:#3b82f6;--green:#10b981;--orange:#f59e0b;--red:#ef4444;
  --sw:240px;--th:52px;--tlh:270px;
}
body{background:var(--bg);color:var(--t1);font-family:'DM Sans',sans-serif;overflow:hidden;height:100vh;}
.shell{display:grid;grid-template-rows:var(--th) 1fr var(--tlh);height:100vh;}
.main{display:grid;grid-template-columns:var(--sw) 1fr 268px;overflow:hidden;}
.topbar{display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--s1);border-bottom:1px solid var(--b1);z-index:10;}
.logo{font-weight:600;font-size:15px;letter-spacing:-.3px;display:flex;align-items:center;gap:6px;margin-right:6px;}
.logo span{color:var(--acc);}
.divider{width:1px;height:24px;background:var(--b1);}
.tbtn{display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:7px;border:1px solid var(--b1);background:var(--s2);color:var(--t2);font-size:12px;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;}
.tbtn:hover{background:var(--s3);color:var(--t1);border-color:var(--b2);}
.tbtn.danger:hover{border-color:var(--red);color:var(--red);}
.export-btn{background:var(--acc);color:#0a1f12;border-color:var(--acc);font-weight:600;margin-left:auto;}
.export-btn:hover{background:var(--acc2);}
.export-btn:disabled{opacity:.5;cursor:not-allowed;}
.ratio-group{display:flex;align-items:center;gap:3px;background:var(--bg);border:1px solid var(--b1);border-radius:8px;padding:3px;}
.ratio-btn{padding:4px 9px;border-radius:5px;border:none;background:transparent;color:var(--t3);font-size:11px;font-weight:500;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;}
.ratio-btn:hover{color:var(--t2);background:var(--s2);}
.ratio-btn.active{background:var(--acc);color:#0a1f12;font-weight:700;}
.preview-canvas{aspect-ratio:16/9;background:#000;border-radius:8px;border:1px solid var(--b1);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none;transition:aspect-ratio .2s ease;max-height:calc(100% - 60px);}
.cancel-btn{background:transparent;color:var(--red);border-color:var(--red);font-weight:600;}
.cancel-btn:hover{background:rgba(239,68,68,.15);color:var(--red);}
.cancel-btn:disabled{opacity:.5;cursor:not-allowed;}
.timecode{font-family:'DM Mono',monospace;font-size:12px;color:var(--t2);padding:4px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--b1);}
.user-area{display:flex;align-items:center;gap:8px;margin-left:4px;}
.user-avatar{width:28px;height:28px;border-radius:50%;background:var(--acc);color:#0a1f12;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logout-btn{color:var(--t3);border-color:var(--b1);}
.logout-btn:hover{color:var(--red);border-color:var(--red);background:rgba(239,68,68,.08);}
.sidebar{background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;}
.stabs{display:flex;border-bottom:1px solid var(--b1);}
.stab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:9px 4px;font-size:9px;color:var(--t3);cursor:pointer;border:none;background:none;transition:all .15s;border-bottom:2px solid transparent;font-family:inherit;}
.stab span{font-size:9px;letter-spacing:.4px;text-transform:uppercase;}
.stab:hover{color:var(--t2);}
.stab.active{color:var(--acc);border-bottom-color:var(--acc);}
.scontent{flex:1;overflow-y:auto;padding:12px;scrollbar-width:thin;scrollbar-color:var(--b1) transparent;}
.scontent::-webkit-scrollbar{width:3px;}
.scontent::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px;}
.upload-zone{border:1.5px dashed var(--b2);border-radius:10px;padding:18px 12px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:12px;}
.upload-zone:hover{border-color:var(--acc);background:rgba(55,229,132,.04);}
.uicon{width:32px;height:32px;background:var(--s3);border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;color:var(--t2);}
.utext{font-size:12px;font-weight:500;color:var(--t2);}
.usub{font-size:10px;color:var(--t3);margin-top:2px;}
.sec-label{font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--b1);}
.mitem{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;background:var(--s2);margin-bottom:5px;cursor:grab;border:1px solid transparent;transition:all .15s;}
.mitem:hover{border-color:var(--b2);background:var(--s3);}
.mthumb{width:40px;height:28px;border-radius:5px;background:var(--s3);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.mthumb video,.mthumb img{width:100%;height:100%;object-fit:cover;}
.minfo{flex:1;min-width:0;}
.mname{font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mmeta{font-size:9px;color:var(--t3);margin-top:1px;}
.madd{padding:3px 8px;border-radius:5px;border:1px solid var(--b2);background:transparent;color:var(--t2);font-size:11px;cursor:pointer;flex-shrink:0;transition:all .15s;display:flex;align-items:center;gap:2px;}
.madd:hover{background:var(--acc);color:#0a1f12;border-color:var(--acc);}
.aitem-v2{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:9px;background:var(--s2);margin-bottom:7px;border:1px solid transparent;transition:all .15s;}
.aitem-v2:hover{border-color:var(--acolor, var(--b2));background:var(--s3);}
.audio-play-btn{width:28px;height:28px;border-radius:50%;border:none;color:#fff;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:transform .15s,filter .15s;}
.audio-play-btn:hover{transform:scale(1.1);filter:brightness(1.2);}
.audio-info{flex:1;min-width:0;cursor:pointer;}
.audio-playing-bar{display:flex;align-items:flex-end;gap:2px;height:14px;margin-top:5px;}
.audio-bar{width:2px;background:var(--acolor,var(--acc));border-radius:1px;animation:audioBounce .6s ease-in-out infinite alternate;}
.audio-bar:nth-child(odd){height:4px;}
.audio-bar:nth-child(even){height:8px;}
@keyframes audioBounce{from{transform:scaleY(.4);}to{transform:scaleY(1);}}
.text-add-btn{width:100%;padding:10px;border-radius:9px;border:1.5px solid var(--orange);background:rgba(245,158,11,.07);color:var(--orange);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;}
.text-add-btn:hover{background:rgba(245,158,11,.15);}
.preview-center{background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:12px 16px;overflow:hidden;gap:0;}
.preview-wrap{width:100%;max-width:720px;display:flex;flex-direction:column;gap:8px;min-height:0;flex:1;}
.preview-empty{text-align:center;color:var(--t3);display:flex;flex-direction:column;align-items:center;}
.preview-empty p{font-size:11px;margin-top:4px;}
.preview-tc{position:absolute;top:8px;right:10px;background:rgba(0,0,0,.7);padding:3px 8px;border-radius:5px;font-size:10px;font-family:'DM Mono',monospace;color:#fff;pointer-events:none;z-index:5;}
.preview-text{position:absolute;transform:translate(-50%,-50%);cursor:move;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.9),0 0 24px rgba(0,0,0,.6);white-space:nowrap;padding:4px 10px;border-radius:4px;border:1.5px solid transparent;transition:border-color .15s;z-index:10;}
.preview-text:hover{border-color:rgba(255,255,255,.5);background:rgba(0,0,0,.35);}
.preview-text.sel-text{border-color:var(--acc) !important;background:rgba(55,229,132,.12);}
.text-move-hint{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);border-radius:3px;padding:2px 5px;opacity:0;transition:opacity .15s;font-size:9px;color:var(--t2);pointer-events:none;display:flex;align-items:center;gap:3px;white-space:nowrap;}
.preview-text:hover .text-move-hint{opacity:1;}
.canvas-controls{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:15;opacity:0;transition:opacity .2s;}
.preview-canvas:hover .canvas-controls{opacity:1;}
.canvas-play{width:52px;height:52px;border-radius:50%;background:var(--acc);border:none;color:#0a1f12;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,filter .15s;box-shadow:0 4px 20px rgba(0,0,0,.6);}
.canvas-play:hover{transform:scale(1.1);filter:brightness(1.1);}
.canvas-skip{width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;backdrop-filter:blur(4px);}
.canvas-skip:hover{background:rgba(0,0,0,.85);border-color:rgba(255,255,255,.5);}
.canvas-progress-bg{position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,.15);cursor:pointer;z-index:16;}
.canvas-progress-bg:hover{height:6px;}
.canvas-progress-fill{height:100%;background:var(--acc);border-radius:0 2px 2px 0;pointer-events:none;transition:width .1s linear;}
.preview-bar{display:flex;align-items:center;gap:8px;padding:4px 2px;}
.preview-bar-time{font-size:10px;font-family:'DM Mono',monospace;color:var(--t3);flex-shrink:0;min-width:40px;}
.preview-bar-time:last-of-type{text-align:right;}
.preview-scrubber{flex:1;height:4px;accent-color:var(--acc);cursor:pointer;border-radius:2px;}
.preview-fullbtn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;border:1px solid var(--acc);background:rgba(55,229,132,.08);color:var(--acc);font-size:11px;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap;flex-shrink:0;}
.preview-fullbtn:hover{background:rgba(55,229,132,.18);}
.right-panel{background:var(--s1);border-left:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;}
.panel-hdr{padding:11px 13px;border-bottom:1px solid var(--b1);font-size:10px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.8px;}
.panel-body{flex:1;overflow-y:auto;padding:12px;scrollbar-width:thin;scrollbar-color:var(--b1) transparent;}
.no-sel{text-align:center;padding-top:28px;color:var(--t3);}
.no-sel p{font-size:11px;margin-top:4px;line-height:1.5;}
.prop-label{font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;margin-top:10px;}
.prop-val{font-size:11px;font-family:'DM Mono',monospace;color:var(--t1);background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 8px;}
.prop-sublabel{font-size:8px;color:var(--t3);margin-bottom:3px;}
.prop-input{font-size:11px;font-family:'DM Mono',monospace;color:var(--t1);background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:5px 8px;outline:none;width:100%;transition:border-color .15s;}
.prop-input:focus{border-color:var(--acc);}
.prop-row{display:flex;gap:6px;margin-top:2px;}
.prop-col{flex:1;}
.del-btn{width:100%;margin-top:14px;padding:7px;border-radius:7px;border:1px solid var(--red);background:rgba(239,68,68,.08);color:var(--red);font-size:11px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px;font-family:inherit;}
.del-btn:hover{background:rgba(239,68,68,.2);}
.tl-section{background:var(--s1);border-top:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;}
.tl-toolbar{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--b1);}
.tl-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;border:1px solid var(--b1);background:var(--s2);color:var(--t2);font-size:11px;font-family:inherit;cursor:pointer;transition:all .15s;}
.tl-btn:hover{background:var(--s3);color:var(--t1);}
.zoom-btn{width:26px;height:26px;border-radius:6px;border:1px solid var(--b1);background:var(--s2);color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.zoom-btn:hover{background:var(--s3);color:var(--t1);}
.zoom-lbl{font-size:10px;color:var(--t3);font-family:'DM Mono',monospace;min-width:34px;text-align:center;}
.tl-scroll{flex:1;overflow-x:auto;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--b1) transparent;}
.tl-scroll::-webkit-scrollbar{height:4px;}
.tl-scroll::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px;}
.tl-inner{position:relative;}
.ruler-row{display:flex;height:22px;border-bottom:1px solid var(--b1);background:var(--bg);position:sticky;top:0;z-index:4;}
.track-lbl-spacer{width:68px;flex-shrink:0;border-right:1px solid var(--b1);}
.ruler-ticks{flex:1;position:relative;cursor:pointer;overflow:hidden;}
.r-tick{position:absolute;top:0;display:flex;flex-direction:column;align-items:flex-start;}
.r-tick-line{width:1px;height:7px;background:var(--b2);}
.r-tick-lbl{font-size:8px;color:var(--t3);font-family:'DM Mono',monospace;margin-top:2px;margin-left:2px;white-space:nowrap;}
.track-row{display:flex;height:50px;border-bottom:1px solid var(--b1);}
.track-lbl{width:68px;flex-shrink:0;display:flex;align-items:center;padding:0 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-right:1px solid var(--b1);position:sticky;left:0;z-index:3;background:var(--s1);}
.track-content{flex:1;position:relative;background:rgba(255,255,255,.015);}
.empty-track{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--t3);pointer-events:none;}
.ph-line{position:absolute;top:0;bottom:0;width:2px;background:var(--acc);z-index:20;pointer-events:none;transform:translateX(-1px);}
.ph-head{position:absolute;top:-1px;left:50%;transform:translateX(-50%);width:9px;height:9px;background:var(--acc);clip-path:polygon(50% 100%,0 0,100% 0);}
.tl-clip{position:absolute;top:4px;height:42px;border-radius:6px;display:flex;align-items:stretch;cursor:grab;user-select:none;border:1.5px solid rgba(255,255,255,.1);transition:border-color .1s,box-shadow .1s;overflow:hidden;}
.tl-clip:active{cursor:grabbing;}
.tl-clip.sel{border-color:#fff !important;box-shadow:0 0 0 1px rgba(255,255,255,.25);}
.clip-inner{flex:1;padding:0 8px;min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden;}
.clip-nm{font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;}
.clip-thumb{width:32px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0;opacity:.85;}
.waveform{flex:1;height:18px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.7) 0,rgba(255,255,255,.7) 1px,transparent 1px,transparent 3px);border-radius:2px;opacity:.25;}
.rh{width:7px;flex-shrink:0;background:rgba(255,255,255,.12);cursor:ew-resize;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
.tl-clip:hover .rh{opacity:1;}
.rh::after{content:'';width:2px;height:12px;background:rgba(255,255,255,.5);border-radius:1px;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.modal-box{background:var(--s1);border:1px solid var(--b2);border-radius:14px;padding:24px;width:370px;box-shadow:0 24px 60px rgba(0,0,0,.6);}
.modal-title{font-size:16px;font-weight:600;margin-bottom:18px;}
.modal-lbl{font-size:10px;color:var(--t2);display:block;margin-bottom:4px;margin-top:12px;}
.modal-inp{width:100%;padding:8px 11px;background:var(--s2);border:1px solid var(--b2);border-radius:7px;color:var(--t1);font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;}
.modal-inp:focus{border-color:var(--acc);}
.modal-hint{font-size:10px;color:var(--t3);margin-top:12px;padding:8px;background:var(--s2);border-radius:6px;line-height:1.6;}
.modal-btns{display:flex;gap:10px;margin-top:16px;}
.modal-cancel{flex:1;padding:9px;border-radius:8px;border:1px solid var(--b2);background:transparent;color:var(--t2);font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;transition:all .15s;}
.modal-cancel:hover{background:var(--s3);color:var(--t1);}
.modal-submit{flex:1;padding:9px;border-radius:8px;border:none;background:var(--acc);color:#0a1f12;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s;}
.modal-submit:hover{background:var(--acc2);}
.notif{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:99px;font-size:12px;font-weight:600;z-index:999;pointer-events:none;animation:nfIn .2s ease;}
.notif.success{background:var(--acc);color:#0a1f12;}
.notif.error{background:var(--red);color:#fff;}
@keyframes nfIn{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
select.modal-inp{appearance:none;}
.mute-btn{width:100%;margin-top:8px;padding:7px;border-radius:7px;border:1px solid var(--b2);background:var(--s2);color:var(--t2);font-size:11px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px;font-family:inherit;}
.mute-btn:hover{border-color:var(--orange);color:var(--orange);background:rgba(245,158,11,.08);}
.mute-btn.muted{border-color:var(--orange);color:var(--orange);background:rgba(245,158,11,.12);}
.clip-mute-badge{display:flex;align-items:center;background:rgba(0,0,0,.5);border-radius:3px;padding:1px 3px;flex-shrink:0;color:var(--orange);}
.fp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:300;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);}
.fp-box{background:var(--bg);border:1px solid var(--b2);border-radius:14px;overflow:hidden;width:min(1100px,96vw);max-height:96vh;box-shadow:0 40px 100px rgba(0,0,0,.8);display:flex;flex-direction:column;}
.fp-header{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-bottom:1px solid var(--b1);background:var(--s1);gap:10px;}
.fp-back-btn{position:fixed;top:18px;left:18px;z-index:400;display:flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(20,30,20,0.85);border:1.5px solid var(--acc);border-radius:10px;color:var(--acc);font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .18s;white-space:nowrap;backdrop-filter:blur(8px);}
.fp-back-btn:hover{background:var(--acc);color:#0a1f12;border-color:var(--acc);}
.fp-title{font-size:12px;font-weight:500;font-family:'DM Mono',monospace;color:var(--t3);flex:1;}
.fp-ctrl-sm{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid var(--b2);background:var(--s2);color:var(--t2);cursor:pointer;transition:all .15s;}
.fp-ctrl-sm:hover{background:var(--b2);color:var(--t1);}
.fp-play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:10;transition:opacity .2s;pointer-events:none;}
.fp-play-overlay > svg{width:56px;height:56px;color:#fff;filter:drop-shadow(0 2px 12px rgba(0,0,0,.8));opacity:.85;}
.fp-canvas{flex:1;min-height:0;aspect-ratio:16/9;background:#000;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;width:100%;}
.fp-ctrl{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;border:1px solid var(--b2);background:var(--s2);color:var(--t2);font-size:11px;cursor:pointer;transition:all .15s;font-family:inherit;}
.fp-ctrl:hover{background:var(--s3);color:var(--t1);}
`;