import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

// Best-effort, in-memory brute-force throttle on the PIN. Persists only within a
// warm serverless instance (not durable across cold starts / regions), but it
// stops naive scripted guessing against the single PIN. For a hard guarantee,
// back this with Vercel KV / Upstash. Keyed by client IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; first: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 5000) attempts.clear(); // bound memory under a spray attack
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

// Constant-time PIN compare. Hash both sides first so timingSafeEqual gets
// equal-length buffers (and the PIN length isn't leaked via a thrown error).
function pinMatches(provided: string, real: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.redirect(new URL('/login?error=throttled', req.url), { status: 303 });
  }

  const form = await req.formData();
  const pin = String(form.get('pin') ?? '');
  const real = process.env.DASHBOARD_PIN;

  if (!real || !pinMatches(pin, real)) {
    return NextResponse.redirect(new URL('/login?error=1', req.url), { status: 303 });
  }

  // Correct PIN — clear the throttle and drop a long-lived cookie.
  attempts.delete(ip);
  const res = NextResponse.redirect(new URL('/', req.url), { status: 303 });
  res.cookies.set(AUTH_COOKIE, await expectedToken(real), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return res;
}
