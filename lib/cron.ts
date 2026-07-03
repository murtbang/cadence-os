// Shared server-side helpers built around the single CRON_SECRET.
// Node runtime only (uses node:crypto) — imported by route handlers, never the
// Edge middleware.

import type { NextRequest } from 'next/server';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Fallback so HMAC never runs with an empty key in local dev (where CRON_SECRET
// is typically unset). Production always has CRON_SECRET configured.
const KEY = () => process.env.CRON_SECRET || 'cadence-local-dev-key';

/**
 * Verify a request carries the shared CRON_SECRET as a Bearer token.
 * Fail-closed: if CRON_SECRET is unset/empty, every request is rejected — this
 * prevents the "Bearer undefined" / "Bearer " bypass. Constant-time compare.
 */
export function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization') ?? '';
  // Hash both sides to fixed 32-byte buffers so timingSafeEqual never throws on
  // a length mismatch (which would otherwise leak length via an exception).
  const a = createHash('sha256').update(header).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

/** HMAC a value with the CRON_SECRET → hex. Used to sign tamper-proof links. */
export function signParams(value: string): string {
  return createHmac('sha256', KEY()).update(value).digest('hex');
}

/** Constant-time verify of a signParams() signature. */
export function verifyParams(value: string, sig: string): boolean {
  if (!sig) return false;
  const expected = Buffer.from(signParams(value));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
