import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

// Fully public at the middleware layer — each self-authenticates downstream:
//  - /login, /api/auth          the PIN screen + its submit handler
//  - /api/discord/interactions  Discord posts here; verified by Ed25519 signature
//  - /api/dismiss-reminder      clicked from a Discord link on any device; HMAC-signed
//  - /api/discord/register      guarded by its own REGISTER_SECRET query param
//  - /api/schedule              voice-memo bot posts here; guarded by SCHEDULE_SECRET header
// Everything else under /api/discord (notify) and /api/cron (incl. the debug
// /test routes) still requires the PIN cookie OR the CRON_SECRET bearer.
const ALWAYS_PUBLIC = [
  '/login',
  '/api/auth',
  '/api/discord/interactions',
  '/api/dismiss-reminder',
  '/api/discord/register',
  '/api/schedule',
];

// Machine credential: the shared CRON_SECRET as a Bearer token. Covers Vercel +
// GitHub cron pings and any headless call to /api/discord/* or other API routes.
function hasCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALWAYS_PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const pin = process.env.DASHBOARD_PIN;
  // Fail-safe: no PIN configured (e.g. local dev) → app stays open.
  if (!pin) return NextResponse.next();

  // Machines (cron jobs, headless scripts) authenticate any API route with the
  // CRON_SECRET bearer instead of the browser cookie.
  if (pathname.startsWith('/api/') && hasCronSecret(req)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken(pin))) {
    return NextResponse.next();
  }

  // Unauthenticated: API calls get 401, page loads go to the PIN screen.
  if (pathname.startsWith('/api/')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets, so the login
  // page can still load its CSS/fonts/icons while logged out.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|fonts/|.*\\.(?:png|svg|ico|webmanifest)$).*)',
  ],
};
