'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const DIM_AFTER_MS  = 5 * 60 * 1000; // 5 minutes idle → inactivity dim
const PEEK_IDLE_MS  = 15_000;         // close peek 15s after last interaction
const NIGHT_START_H = 0;              // midnight (LA)
const NIGHT_END_H   = 7;             // 7 AM (LA)

function getLAHour(): number {
  return parseInt(
    new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles',
    }),
    10,
  );
}

export default function ScreenGuard() {
  const [dimmed,    setDimmed]    = useState(false); // inactivity overlay
  const [nightMode, setNightMode] = useState(false); // time-based overlay
  const [peeking,   setPeeking]   = useState(false); // temporarily lift night overlay
  const [peekKey,   setPeekKey]   = useState(0);     // increments to restart bar animation
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Night mode ───────────────────────────────────────────────────────────
  useEffect(() => {
    function check() {
      const h = getLAHour();
      setNightMode(h >= NIGHT_START_H && h < NIGHT_END_H);
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Inactivity timer ────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDimmed(true), DIM_AFTER_MS);
  }, []);

  useEffect(() => {
    function onActivity() {
      setDimmed(false);
      resetTimer();
    }
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  // ── Peek idle reset — any activity during a peek extends it ─────────────
  const resetPeek = useCallback(() => {
    if (!peekRef.current) return; // only active while peeking
    clearTimeout(peekRef.current);
    peekRef.current = setTimeout(() => {
      setPeeking(false);
      peekRef.current = null;
    }, PEEK_IDLE_MS);
    setPeekKey(k => k + 1); // restart the countdown bar animation
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetPeek, { passive: true }));
    return () => events.forEach(ev => window.removeEventListener(ev, resetPeek));
  }, [resetPeek]);

  // ── Tap handlers ─────────────────────────────────────────────────────────

  function handleDimTap() {
    setDimmed(false);
    resetTimer();
  }

  function handlePeek() {
    setPeeking(true);
    // Start the idle countdown — any interaction will reset it via resetPeek
    peekRef.current = setTimeout(() => {
      setPeeking(false);
      peekRef.current = null;
    }, PEEK_IDLE_MS);
  }

  // Night overlay opacity: 0 when peeking or not night, 0.92 otherwise
  const nightOpacity = nightMode && !peeking ? 0.92 : 0;
  // Inactivity overlay opacity: always on top of night
  const dimOpacity   = dimmed ? 0.92 : 0;

  return (
    <>
      {/* ── Night mode overlay (passive, pass-through) ── */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,1)',
          opacity: nightOpacity,
          transition: 'opacity 2s ease',
          pointerEvents: 'none',
        }}
      />

      {/* ── Peek button (visible when night mode active + not dimmed + not peeking) ── */}
      {nightMode && !dimmed && !peeking && (
        <button
          type="button"
          onClick={handlePeek}
          style={{
            position: 'fixed', bottom: '24px', left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9991,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.35)',
            borderRadius: '99px',
            padding: '8px 20px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Hold to peek
        </button>
      )}

      {/* ── Peek countdown bar ── */}
      {peeking && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9992,
          height: '2px', background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}>
          <div key={peekKey} style={{
            height: '100%', background: 'rgba(255,255,255,0.3)',
            animation: `shrink ${PEEK_IDLE_MS / 1000}s linear forwards`,
          }} />
          <style>{`@keyframes shrink { from { width:100% } to { width:0% } }`}</style>
        </div>
      )}

      {/* ── Inactivity dim overlay (intercepts taps) ── */}
      <div
        onClick={dimOpacity > 0 ? handleDimTap : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 9995,
          background: 'rgba(0,0,0,1)',
          opacity: dimOpacity,
          transition: 'opacity 1.5s ease',
          pointerEvents: dimmed ? 'auto' : 'none',
          cursor: dimmed ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {dimmed && (
          <span style={{
            color: 'rgba(255,255,255,0.12)',
            fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            Tap to wake
          </span>
        )}
      </div>
    </>
  );
}
