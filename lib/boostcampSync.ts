// Triggers an on-demand Boostcamp pull on the Railway sync service.
// The service runs the pull in the background and returns immediately (202).
// With App Sleeping on, the first request after idle also wakes the service —
// hence the generous timeout to absorb the cold start.
//
// Env (set in Vercel):
//   BOOSTCAMP_SYNC_URL    e.g. https://cadence-boostcamp-sync.up.railway.app
//   BOOSTCAMP_SYNC_SECRET shared secret, matches the service's BOOSTCAMP_SYNC_SECRET

type SyncResult =
  | { ok: true; status: 'started' | 'already_running' }
  | { ok: false; status: number; error: string };

export async function triggerBoostcampSync(): Promise<SyncResult> {
  const base   = process.env.BOOSTCAMP_SYNC_URL;
  const secret = process.env.BOOSTCAMP_SYNC_SECRET;

  if (!base || !secret) {
    return { ok: false, status: 503, error: 'Sync service not configured (BOOSTCAMP_SYNC_URL / BOOSTCAMP_SYNC_SECRET)' };
  }

  // Tolerate a URL set without a scheme (e.g. "foo.up.railway.app") — fetch requires one.
  const origin = (/^https?:\/\//i.test(base) ? base : `https://${base}`).replace(/\/$/, '');

  try {
    const res = await fetch(`${origin}/sync`, {
      method:  'POST',
      headers: { 'X-Sync-Secret': secret },
      cache:   'no-store',
      signal:  AbortSignal.timeout(30_000), // headroom for a cold start (scale-to-zero wake)
    });

    if (res.status === 409) return { ok: true, status: 'already_running' };

    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: 502, error: body.error ?? 'Sync service error' };
    return { ok: true, status: body.status === 'already_running' ? 'already_running' : 'started' };
  } catch (err) {
    console.error('boostcamp sync trigger error:', err);
    return { ok: false, status: 502, error: 'Could not reach sync service' };
  }
}
