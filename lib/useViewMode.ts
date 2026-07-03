'use client';

import { useEffect, useState } from 'react';

export type ViewMode = 'tablet' | 'mobile';

const STORAGE_KEY = 'cadence-view-mode';

// iPhone 16 Pro Max portrait is 440 CSS px; the Galaxy Tab A7 Lite is
// comfortably wider (~533px+). A 480px cutoff cleanly separates phones from
// the tablet, so the tablet can never be misread as a phone.
export const PHONE_MAX_WIDTH = 480;

const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;

export function readStoredMode(): ViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'tablet' || v === 'mobile' ? v : null;
  } catch {
    return null;
  }
}

export function storeMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function isPhoneWidth(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

/** Live phone-width flag that updates on resize / rotation. */
export function useIsPhoneWidth(): boolean {
  const [phone, setPhone] = useState<boolean>(isPhoneWidth);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const handler = () => setPhone(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return phone;
}
