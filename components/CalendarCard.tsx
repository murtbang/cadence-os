'use client';

import { useEffect, useRef, useState, forwardRef } from 'react';
import { CalendarEvent } from '@/types/database';

const PIP_COLORS: Record<CalendarEvent['category'], string> = {
  personal: 'var(--green)',
  client: 'var(--orange)',
  work: 'var(--blue)',
  'deep-work': 'var(--indigo)',
  other: 'var(--gray-4)',
};

interface CalendarCardProps {
  events: CalendarEvent[];
  wide?: boolean;
  onNavigate?: () => void;
}

export default function CalendarCard({ events, wide, onNavigate }: CalendarCardProps) {
  const nowRef = useRef<HTMLDivElement>(null);
  const [nowPosition, setNowPosition] = useState<number | null>(null);

  useEffect(() => {
    function calcNow() {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      let insertIdx = events.findIndex(e => {
        const [h, m] = e.startTime.split(':').map(Number);
        return h * 60 + m > nowMins;
      });
      if (insertIdx === -1) insertIdx = events.length;
      setNowPosition(insertIdx);
    }
    calcNow();
    const id = setInterval(calcNow, 60000);
    return () => clearInterval(id);
  }, [events]);

  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [nowPosition]);

  const sorted = [...events].sort((a, b) => {
    const [ah, am] = a.startTime.split(':').map(Number);
    const [bh, bm] = b.startTime.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--r-lg)',
      padding: '12px 14px',
      boxShadow: 'var(--shadow)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      gridColumn: wide ? 'span 2' : undefined,
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Today - Google Calendar
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Open calendar"
            style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 8px', WebkitTapHighlightColor: 'transparent' }}
          >
            Open
          </button>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--gray-4)', paddingTop: '4px' }}>No events today</div>
        )}
        {sorted.map((event, idx) => (
          <div key={event.id}>
            {nowPosition === idx && <NowBar ref={nowRef} />}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '5px 0',
              borderBottom: idx < sorted.length - 1 ? '0.5px solid var(--sep)' : 'none',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 400,
                color: 'var(--gray-4)',
                width: '36px',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--font-geist-mono), monospace',
              }}>
                {event.startTime}
              </div>
              <div style={{ width: '3px', height: '26px', borderRadius: '2px', background: PIP_COLORS[event.category], flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--black)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                {event.subtitle && <div style={{ fontSize: '10px', color: 'var(--gray-3)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.subtitle}</div>}
              </div>
            </div>
          </div>
        ))}
        {nowPosition === sorted.length && <NowBar ref={nowRef} />}
      </div>
    </div>
  );
}

const NowBar = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', flexShrink: 0 }}>
    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
    <div style={{ flex: 1, height: '0.5px', background: 'var(--red)', opacity: 0.5 }} />
  </div>
));
NowBar.displayName = 'NowBar';
