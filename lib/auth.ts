// Shared auth helpers. Pure Web Crypto so this works in both the Edge
// middleware runtime and the Node route handlers.

export const AUTH_COOKIE = 'cadence_auth';

// Token derived from the PIN via HMAC keyed on a server-side secret (CRON_SECRET,
// reused so no extra env var is needed). The cookie stores this — never the raw
// PIN — and the middleware recomputes it to validate. Keying on a secret means
// the token can't be reproduced from the (low-entropy) PIN alone, even if it
// leaks. Uses Web Crypto so it runs in both the Edge middleware and Node routes.
//
// NOTE: rotating CRON_SECRET invalidates all existing cookies (every device must
// re-enter the PIN once).
export async function expectedToken(pin: string): Promise<string> {
  // Fallback key for local dev where CRON_SECRET is usually unset; importKey
  // rejects a zero-length key. Production always has CRON_SECRET set.
  const keyMaterial = process.env.CRON_SECRET || 'cadence-local-dev-key';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${pin}:cadence-auth`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
