import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./FocusDeckPosition.css";
import useStageUtilityTarget from "./useStageUtilityTarget";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const SPOTIFY_KEY = "plotflow-focus-spotify-url-v1";

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function createNoiseBuffer(ctx, seconds = 2) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.018 * white) / 1.018;
    data[i] = last * 3.2;
  }
  return buffer;
}

function spotifyEmbedUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/(^|\.)spotify\.com$/i.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const typeIndex = parts.findIndex((part) => ["track", "playlist", "album", "artist", "show", "episode"].includes(part));
    if (typeIndex < 0 || !parts[typeIndex + 1]) return "";
    return `https://open.spotify.com/embed/${parts[typeIndex]}/${parts[typeIndex + 1]}?utm_source=generator&theme=0`;
  } catch {
    return "";
  }
}

export default function FocusDeck() {
  const [open, setOpen] = useState(false);
  const [zen, setZen] = useState(false);
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [noiseOn, setNoiseOn] = useState(false);
  const [volume, setVolume] = useState(0.16);
  const [spotifyUrl, setSpotifyUrl] = useState(() => localStorage.getItem(SPOTIFY_KEY) || "");
  const [spotifyDraft, setSpotifyDraft] = useState(() => localStorage.getItem(SPOTIFY_KEY) || "");
  const [spotifyMessage, setSpotifyMessage] = useState("");
  const ctxRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const gainRef = useRef(null);
  const utilityTarget = useStageUtilityTarget();

  useEffect(() => {
    document.body.classList.toggle("plotflow-zen-mode", zen);
    return () => document.body.classList.remove("plotflow-zen-mode");
  }, [zen]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;
        setRunning(false);
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 660;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);
          }
        } catch {}
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => () => stopNoise(), []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setRunning(false);
    setSecondsLeft(nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  }

  function resetTimer() {
    setRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  }

  async function startNoise() {
    if (noiseSourceRef.current) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = ctxRef.current || new AudioCtx();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = createNoiseBuffer(ctx);
    source.loop = true;
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
    noiseSourceRef.current = source;
    gainRef.current = gain;
    setNoiseOn(true);
  }

  function stopNoise() {
    try { noiseSourceRef.current?.stop(); } catch {}
    try { noiseSourceRef.current?.disconnect(); } catch {}
    noiseSourceRef.current = null;
    gainRef.current = null;
    setNoiseOn(false);
  }

  function toggleNoise() {
    if (noiseOn) stopNoise();
    else startNoise();
  }

  function connectSpotify() {
    const embed = spotifyEmbedUrl(spotifyDraft);
    if (!embed) {
      setSpotifyMessage("Paste a valid Spotify track, album or playlist link.");
      return;
    }
    const next = spotifyDraft.trim();
    localStorage.setItem(SPOTIFY_KEY, next);
    setSpotifyUrl(next);
    setSpotifyMessage("Spotify connected");
  }

  function disconnectSpotify() {
    localStorage.removeItem(SPOTIFY_KEY);
    setSpotifyUrl("");
    setSpotifyDraft("");
    setSpotifyMessage("");
  }

  const progressTotal = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / progressTotal));
  const embedUrl = spotifyEmbedUrl(spotifyUrl);

  if (!utilityTarget) return null;

  return createPortal(
    <div className="stage-utility-item focus-utility-item">
      <button
        type="button"
        className={`focus-orb ${running ? "active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        title="Creative Focus"
      >
        <span>◉</span>
        <strong>{running ? formatClock(secondsLeft) : "Focus"}</strong>
      </button>

      {open && (
        <section className="focus-deck" aria-label="Creative Focus">
          <header className="focus-deck-head">
            <div>
              <span>CREATIVE FOCUS</span>
              <strong>PhongFlow Session</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="focus-modes">
            <button type="button" className={mode === "focus" ? "active" : ""} onClick={() => switchMode("focus")}>25 Focus</button>
            <button type="button" className={mode === "break" ? "active" : ""} onClick={() => switchMode("break")}>5 Break</button>
          </div>

          <div className="focus-clock-wrap">
            <div className="focus-clock">{formatClock(secondsLeft)}</div>
            <div className="focus-progress"><i style={{ width: `${progress * 100}%` }} /></div>
            <div className="focus-clock-actions">
              <button type="button" className="primary" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : secondsLeft === 0 ? "Restart" : "Start"}</button>
              <button type="button" onClick={resetTimer}>Reset</button>
            </div>
          </div>

          <div className="focus-divider" />

          <button type="button" className={`zen-toggle ${zen ? "active" : ""}`} onClick={() => setZen((value) => !value)}>
            <span>⌘</span>
            <div><strong>Zen Canvas</strong><small>{zen ? "Canvas only · distraction off" : "Hide panels, keep the artwork"}</small></div>
            <b>{zen ? "ON" : "OFF"}</b>
          </button>

          <div className="focus-audio">
            <div className="focus-audio-row">
              <button type="button" className={noiseOn ? "active" : ""} onClick={toggleNoise}>≈ Brown Noise</button>
              <span className="spotify-chip">Spotify</span>
            </div>
            <label className="focus-spotify-connect">
              <span>Spotify link</span>
              <div>
                <input
                  type="url"
                  value={spotifyDraft}
                  onChange={(event) => { setSpotifyDraft(event.target.value); setSpotifyMessage(""); }}
                  onKeyDown={(event) => { if (event.key === "Enter") connectSpotify(); }}
                  placeholder="Paste playlist / track / album link"
                />
                <button type="button" onClick={connectSpotify}>Connect</button>
              </div>
            </label>
            {spotifyMessage && <small className="spotify-message">{spotifyMessage}</small>}
            {embedUrl && (
              <div className="spotify-embed-wrap">
                <iframe
                  title="Spotify focus player"
                  src={embedUrl}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
                <button type="button" className="spotify-disconnect" onClick={disconnectSpotify}>Disconnect Spotify</button>
              </div>
            )}
            <label className="focus-volume">Brown Noise Volume<input type="range" min="0" max="0.4" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          </div>

          <p className="focus-quote">Less noise. More intent.</p>
        </section>
      )}
    </div>,
    utilityTarget
  );
}
