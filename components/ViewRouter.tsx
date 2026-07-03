'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  ViewMode,
  readStoredMode,
  storeMode,
  isPhoneWidth,
  useIsPhoneWidth,
} from '@/lib/useViewMode';

const HomeClient   = dynamic(() => import('@/components/HomeClient'),   { ssr: false });
const MobileClient = dynamic(() => import('@/components/MobileClient'), { ssr: false });

type Resolved = ViewMode | 'choosing';

function resolveInitial(): Resolved {
  const stored = readStoredMode();
  if (stored) return stored;
  // No saved choice yet. Only phone-width screens get the one-time chooser;
  // everything wider (the A7 Lite included) silently uses the tablet view and
  // is never persisted — so the tablet experience stays completely untouched.
  return isPhoneWidth() ? 'choosing' : 'tablet';
}

export default function ViewRouter() {
  const [resolved, setResolved] = useState<Resolved>(resolveInitial);

  const choose = useCallback((mode: ViewMode) => {
    storeMode(mode);
    setResolved(mode);
  }, []);

  if (resolved === 'choosing') {
    return <ViewChooser onChoose={choose} />;
  }

  if (resolved === 'mobile') {
    return <MobileClient onSwitchToTablet={() => choose('tablet')} />;
  }

  // Tablet — today's app, rendered exactly as before. The "Mobile view" pill
  // only renders on phone-width screens, so the A7 Lite never sees it.
  return (
    <>
      <HomeClient />
      <SwitchToMobilePill onClick={() => choose('mobile')} />
    </>
  );
}

// ── One-time chooser (phones only) ──────────────────────────────────────────────

function ViewChooser({ onChoose }: { onChoose: (mode: ViewMode) => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)', color: 'var(--black)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '28px', padding: '32px',
      paddingTop: 'calc(env(safe-area-inset-top) + 32px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
          Cadence
        </div>
        <h1 style={{ marginTop: '10px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--black)' }}>
          Pick a view
        </h1>
        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gray-3)', lineHeight: 1.5, maxWidth: '300px' }}>
          You can switch anytime. We remember your choice on this device.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <ChooserButton
          title="Mobile"
          subtitle="Optimised for this phone"
          accent="var(--blue)"
          onClick={() => onChoose('mobile')}
        />
        <ChooserButton
          title="Tablet"
          subtitle="The full original layout"
          accent="var(--gray-5)"
          onClick={() => onChoose('tablet')}
        />
      </div>
    </div>
  );
}

function ChooserButton({ title, subtitle, accent, onClick }: { title: string; subtitle: string; accent: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--card)', border: `1.5px solid ${accent}`,
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)',
        padding: '18px 18px', cursor: 'pointer', color: 'var(--black)',
        display: 'flex', flexDirection: 'column', gap: '3px',
      }}
    >
      <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</span>
      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--gray-3)' }}>{subtitle}</span>
    </button>
  );
}

// ── Tablet → Mobile escape hatch (phones only) ──────────────────────────────────

function SwitchToMobilePill({ onClick }: { onClick: () => void }) {
  const phone = useIsPhoneWidth();
  if (!phone) return null; // never rendered on the A7 Lite

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'fixed', zIndex: 1000,
        left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom) + 14px)',
        display: 'flex', alignItems: 'center', gap: '7px',
        background: 'var(--blue)', color: 'var(--bg)',
        border: 'none', borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--shadow)', cursor: 'pointer',
        padding: '11px 18px', fontSize: '13px', fontWeight: 800,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
      Mobile view
    </button>
  );
}
