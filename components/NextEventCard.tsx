'use client';

import { useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';
import { CalendarEvent } from '@/types/database';

interface NextEventCardProps {
  event: CalendarEvent | null;
  onNavigate?: () => void;
}

function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** Start Date of the event, using its date if present (else today). */
function eventStart(event: CalendarEvent): Date {
  const [h, m] = event.startTime.split(':').map(Number);
  const d = event.date ? new Date(`${event.date}T00:00:00`) : new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function useCountdown(event: CalendarEvent | null) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!event) return;
    function update() {
      const diffMs = eventStart(event!).getTime() - Date.now();
      if (diffMs <= 0) { setLabel('now'); return; }
      const mins = Math.round(diffMs / 60000);
      if (mins < 60) { setLabel(`in ${mins}m`); return; }
      if (mins < 1440) {
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        setLabel(rem > 0 ? `in ${hrs}h ${rem}m` : `in ${hrs}h`);
        return;
      }
      const days = Math.floor(mins / 1440);
      const hrs  = Math.floor((mins % 1440) / 60);
      setLabel(hrs > 0 ? `in ${days}d ${hrs}h` : `in ${days}d`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [event]);

  return label;
}

/** "Fri, Jul 3" when the event isn't today; empty string if it is today. */
function dateLabel(event: CalendarEvent): string {
  if (!event.date) return '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  if (event.date === today) return '';
  return new Date(`${event.date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

async function shareToDiscord(event: CalendarEvent) {
  const time     = to12h(event.startTime);
  const location = event.subtitle ? ` — ${event.subtitle}` : '';
  const meet     = event.meetLink ? `\n🔗 ${event.meetLink}` : '';
  await fetch('/api/discord/notify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: `📅 **${event.title}** at ${time}${location}${meet}` }),
  });
}

export default function NextEventCard({ event, onNavigate }: NextEventCardProps) {
  const countdown = useCountdown(event);
  const dayLabel  = event ? dateLabel(event) : '';
  const [shared, setShared] = useState(false);

  async function handleShare() {
    if (!event) return;
    setShared(true);
    await shareToDiscord(event);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <section style={{
      background: 'var(--card)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow)',
      border: '1px solid var(--sep)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      position: 'relative',
    }}>
      {onNavigate && (
        <span onClick={onNavigate} style={{ position: 'absolute', top: 0, right: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>↗</span>
      )}
      {/* Header */}
      <div style={{ marginBottom: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
          Next Event
        </span>
      </div>

      {event ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(255,159,10,0.12)', color: 'var(--orange)',
              fontSize: '11px', fontWeight: 850,
              padding: '3px 9px', borderRadius: 'var(--r-pill)',
              marginBottom: '8px', width: 'fit-content',
            }}>
              {countdown}
            </div>

            {dayLabel && (
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--gray-3)', marginBottom: '4px', letterSpacing: '-0.2px' }}>
                {dayLabel}
              </div>
            )}

            <div style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: '28px', fontWeight: 450, letterSpacing: '-1px',
              lineHeight: 1, color: 'var(--black)', fontVariantNumeric: 'tabular-nums',
              marginBottom: '8px',
            }}>
              {to12h(event.startTime)}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--black)', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
              {event.title}
            </div>

            {event.subtitle && (
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)', marginTop: '4px', lineHeight: 1.3 }}>
                {event.subtitle}
              </div>
            )}
          </div>

          <IonButton
            fill="clear"
            size="small"
            onClick={handleShare}
            style={{ '--color': shared ? 'var(--green)' : 'var(--gray-4)', '--padding-start': '0', alignSelf: 'flex-start', fontSize: '11px', marginTop: '6px' }}
          >
            {shared ? '✓ Sent' : '↗ Discord'}
          </IonButton>
        </div>
      ) : (
        <div style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }}>
          No upcoming events
        </div>
      )}
    </section>
  );
}
