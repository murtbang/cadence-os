'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

const HALF_FLIP_MS     = 180;
const RANDOM_INTERVALS = [10_000, 30_000, 60_000, 300_000];

interface FlipCardProps {
  faces: ReactNode[];
  intervalMs?: number;
}

type Phase = 'idle' | 'exiting' | 'entering';

export default function FlipCard({ faces, intervalMs }: FlipCardProps) {
  const [resolvedInterval] = useState<number>(
    () => intervalMs ?? RANDOM_INTERVALS[Math.floor(Math.random() * RANDOM_INTERVALS.length)]
  );
  const [faceIdx, setFaceIdx] = useState(0);
  const [phase,   setPhase]   = useState<Phase>('idle');
  const [paused,  setPaused]  = useState(false);
  // True while an input inside a face is focused (e.g. editing weight) — keeps
  // the card from auto-flipping out from under the user mid-entry.
  const [focused, setFocused] = useState(false);
  const pendingIdx   = useRef(0);
  const touchStartX  = useRef<number | null>(null);
  const touchStartY  = useRef<number | null>(null);
  const resumeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(next: number) {
    if (phase !== 'idle' || next === faceIdx || faces.length <= 1) return;
    pendingIdx.current = next;
    setPhase('exiting');
  }

  function advance(dir: 1 | -1 = 1) {
    goTo((faceIdx + dir + faces.length) % faces.length);
  }

  useEffect(() => {
    if (phase === 'exiting') {
      const t = setTimeout(() => { setFaceIdx(pendingIdx.current); setPhase('entering'); }, HALF_FLIP_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'entering') {
      const t = setTimeout(() => setPhase('idle'), HALF_FLIP_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (paused || focused || faces.length <= 1) return;
    const t = setInterval(() => advance(1), resolvedInterval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, focused, faces.length, faceIdx, resolvedInterval]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    // Pause auto-flip while user is touching
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only treat as a horizontal swipe if X movement dominates Y (not a scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      advance(deltaX < 0 ? 1 : -1);
    }

    // Resume auto-flip after a short pause so the card can be examined
    resumeTimer.current = setTimeout(() => setPaused(false), 3000);
  }

  const scaleX     = phase === 'exiting' ? 0 : 1;
  const transition = phase !== 'idle' ? `transform ${HALF_FLIP_MS}ms ease-in-out` : 'none';

  return (
    <div
      style={{ position: 'relative', minHeight: 0, overflow: 'hidden' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
    >
      {/*
        display:grid makes the single child stretch to fill inset:0,
        identical to how CSS Grid stretched cards when they were direct
        grid children in the dashboard layout.
      */}
      <div style={{
        position:        'absolute',
        inset:           0,
        display:         'grid',
        transform:       `scaleX(${scaleX})`,
        transition,
        transformOrigin: 'center center',
      }}>
        {faces[faceIdx]}
      </div>

      {/* Dots: pure overlay, zero effect on layout or card size */}
      {faces.length > 1 && (
        <div style={{
          position:       'absolute',
          bottom:         9,
          left:           '50%',
          transform:      'translateX(-50%)',
          display:        'flex',
          gap:            5,
          zIndex:         10,
          pointerEvents:  'none', // let taps through to the card below
        }}>
          {faces.map((_, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              style={{
                width:        i === faceIdx ? 14 : 6,
                height:       6,
                borderRadius: 3,
                background:   i === faceIdx ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)',
                cursor:       'pointer',
                transition:   'all 0.3s ease',
                flexShrink:   0,
                pointerEvents: 'auto',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
