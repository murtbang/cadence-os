'use client';

import React from 'react';

export type MobileTab = 'home' | 'habits' | 'todos' | 'calendar' | 'more';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'home',     label: 'Home' },
  { id: 'habits',   label: 'Habits' },
  { id: 'todos',    label: 'To-do' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'more',     label: 'More' },
];

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  unreadCount?: number;
}

export default function MobileTabBar({ active, onChange, unreadCount = 0 }: Props) {
  return (
    <nav style={{
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      background: 'var(--sidebar)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderTop: '0.5px solid var(--sep)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(item => {
        const on = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-label={item.label}
            aria-current={on ? 'page' : undefined}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 0 7px', minHeight: '52px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              color: on ? 'var(--blue)' : 'var(--gray-3)',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.15s',
            }}
          >
            <TabIcon id={item.id} />
            <span style={{ fontSize: '10px', fontWeight: on ? 800 : 600, letterSpacing: '0.01em' }}>{item.label}</span>
            {item.id === 'more' && unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '4px', right: '50%', marginRight: '-16px',
                minWidth: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--red)', border: '1.5px solid var(--sidebar)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function TabIcon({ id }: { id: MobileTab }) {
  const common = {
    width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'home':
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></svg>;
    case 'habits':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12l2.5 2.5L16 9" /></svg>;
    case 'todos':
      return <svg {...common}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6l1 1 2-2" /><path d="M4 12l1 1 2-2" /><path d="M4 18l1 1 2-2" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></svg>;
    case 'more':
      return <svg {...common}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
  }
}
