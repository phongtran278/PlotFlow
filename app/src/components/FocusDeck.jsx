import { useEffect, useRef, useState } from "react";
import "./FocusDeckPosition.css";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

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

export default function FocusDeck() {
  const [open, setOpen] = useState(false);
  const [zen, setZen] = useState(false);
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [noiseOn, setNoiseOn] = useState(false);
  const [volume, setVolume] = useState(0.16);
  const [localTrackName, setLocalTrackName] = useState("");
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const gainRef = useRef(null);

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
    if (audioRef.current) audioRef.current.volume = Math.min(1, volume * 2.5);
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

  function chooseLocalTrack(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (audioRef.current?.src?.startsWith("blob:")) URL.revokeObjectURL(audioRef.current.src);
    const src = URL.createObjectURL(file);
    audioRef.current.src = src;
    audioRef.current.loop = true;
    audioRef.current.volume = Math.min(1, volume * 2.5);
    audioRef.current.play().catch(() => {});
    setLocalTrackName(file.name);
    event.target.value = "";
  }

  const progressTotal = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / progressTotal));

  return (
    <>
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
              <strong>Đời lắm Phong Trần.</strong>
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
              <label className="local-audio-button">♫ Local Audio<input type="file" accept="audio/*" onChange={chooseLocalTrack} hidden /></label>
            </div>
            {localTrackName && <small className="local-track-name">Playing · {localTrackName}</small>}
            <label className="focus-volume">Volume<input type="range" min="0" max="0.4" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          </div>

          <p className="focus-quote">Less noise. More intent.</p>
          <audio ref={audioRef} />
        </section>
      )}
    </>
  );
}
