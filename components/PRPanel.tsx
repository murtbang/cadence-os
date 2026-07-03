'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { PR } from '@/types/database';
import { estimate1RM } from '@/lib/oneRepMax';

const TZ = 'America/Los_Angeles';

const SUGGESTED_LIFTS = [
  'Deadlift', 'Squat', 'Bench Press', 'Overhead Press', 'Barbell Row',
  'Pull-up', 'Romanian Deadlift', 'Front Squat', 'Hip Thrust', 'Incline Bench Press',
];

interface DerivedPR { exercise: string; weight_lbs: number; reps: number; achieved_at: string }

// Unified row from either source.
interface Entry {
  id:          string | null; // null = derived from Boostcamp (read-only)
  exercise:    string;
  weight_lbs:  number;
  reps:        number;
  achieved_at: string;
  note:        string | null;
  source:      'manual' | 'boostcamp';
}

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const thisYear = new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() === thisYear ? undefined : 'numeric',
    timeZone: TZ,
  });
}

interface Group {
  key:     string;
  name:    string;
  entries: Entry[]; // newest first
  best:    Entry;
  best1RM: number;
}

function buildGroups(entries: Entry[]): Group[] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.exercise.trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  const groups: Group[] = Array.from(map.entries()).map(([key, list]) => {
    list.sort((a, b) => b.achieved_at.localeCompare(a.achieved_at));
    let best = list[0];
    let best1RM = estimate1RM(best.weight_lbs, best.reps);
    for (const e of list) {
      const e1 = estimate1RM(e.weight_lbs, e.reps);
      if (e1 > best1RM) { best = e; best1RM = e1; }
    }
    return { key, name: best.exercise.trim(), entries: list, best, best1RM };
  });
  groups.sort((a, b) => b.entries[0].achieved_at.localeCompare(a.entries[0].achieved_at));
  return groups;
}

export default function PRPanel() {
  const [manual, setManual]   = useState<PR[]>([]);
  const [derived, setDerived] = useState<DerivedPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mRes, dRes] = await Promise.all([
        fetch(`/api/prs?_=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/prs/derived?_=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const m = await mRes.json(); if (Array.isArray(m)) setManual(m);
      const d = await dRes.json(); if (Array.isArray(d)) setDerived(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const entries: Entry[] = useMemo(() => [
    ...manual.map(p => ({ id: p.id, exercise: p.exercise, weight_lbs: p.weight_lbs, reps: p.reps, achieved_at: p.achieved_at, note: p.note, source: 'manual' as const })),
    ...derived.map(d => ({ id: null, exercise: d.exercise, weight_lbs: d.weight_lbs, reps: d.reps, achieved_at: d.achieved_at, note: null, source: 'boostcamp' as const })),
  ], [manual, derived]);

  const groups = useMemo(() => buildGroups(entries), [entries]);

  const bestByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) m.set(g.key, g.best1RM);
    return m;
  }, [groups]);

  const handleAdded = useCallback((created: PR, wasNewBest: boolean) => {
    setManual(prev => [created, ...prev]);
    if (wasNewBest) {
      setFlash(`🎉 New ${created.exercise.trim()} PR — ${estimate1RM(created.weight_lbs, created.reps)} est. 1RM`);
      setTimeout(() => setFlash(null), 6000);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setManual(prev => prev.filter(p => p.id !== id));
    try { await fetch(`/api/prs/${id}`, { method: 'DELETE' }); } catch { load(); }
  }, [load]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

      <AddPRForm existingNames={groups.map(g => g.name)} bestByKey={bestByKey} onAdded={handleAdded} />

      {flash && (
        <div style={{ flexShrink: 0, background: 'var(--green)', color: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: '12px', fontWeight: 800 }}>
          {flash}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontWeight: 600, padding: '8px 2px' }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--gray-4)', fontSize: '12px', fontWeight: 600, lineHeight: 1.6 }}>
            No PRs yet.<br />They appear automatically from your Boostcamp sets — or log one above.
          </div>
        ) : (
          groups.map(g => (
            <PRGroupRow
              key={g.key}
              group={g}
              open={expanded === g.key}
              onToggle={() => setExpanded(prev => prev === g.key ? null : g.key)}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Exercise group row ──────────────────────────────────────────────────────────

function SourceTag({ source }: { source: 'manual' | 'boostcamp' }) {
  const boost = source === 'boostcamp';
  return (
    <span style={{
      fontSize: '8px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 5px', borderRadius: 'var(--r-pill)',
      background: boost ? 'rgba(90,200,250,0.16)' : 'var(--gray-6)',
      color: boost ? '#5AC8FA' : 'var(--gray-3)',
    }}>
      {boost ? 'Boostcamp' : 'Manual'}
    </span>
  );
}

function PRGroupRow({ group, open, onToggle, onDelete }: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const { name, best, best1RM, entries } = group;
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', overflow: 'hidden', flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 750, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-4)' }}>
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} · {formatDate(entries[0].achieved_at)}
            </span>
            <SourceTag source={best.source} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '15px', fontWeight: 750, color: 'var(--black)', letterSpacing: '-0.5px' }}>
            {best.weight_lbs}<span style={{ fontSize: '11px', color: 'var(--gray-3)', fontWeight: 600 }}> × {best.reps}</span>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--orange)' }}>{best1RM} est. 1RM</div>
        </div>
        <span style={{ color: 'var(--gray-4)', fontSize: '14px', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>›</span>
      </button>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--sep)', padding: '4px 6px 6px' }}>
          {entries.map((e, i) => {
            const isBest = e === best;
            return (
              <div key={e.id ?? `d-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px', padding: '0 6px' }}>
                <div style={{ width: '8px', flexShrink: 0 }}>
                  {isBest && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--orange)' }} title="Best" />}
                </div>
                <div style={{ flex: 1, fontFamily: 'var(--font-geist-mono), monospace', fontSize: '12.5px', fontWeight: 650, color: 'var(--gray-1)' }}>
                  {e.weight_lbs} × {e.reps}
                  <span style={{ color: 'var(--gray-4)', fontWeight: 500 }}>  ·  {estimate1RM(e.weight_lbs, e.reps)} e1RM</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--gray-4)', fontWeight: 600, flexShrink: 0 }}>{formatDate(e.achieved_at)}</span>
                {e.source === 'manual' && e.id ? (
                  <button
                    type="button"
                    onClick={() => onDelete(e.id as string)}
                    aria-label="Delete entry"
                    style={{ width: '36px', height: '36px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
                  >×</button>
                ) : (
                  <span style={{ width: '36px', flexShrink: 0, textAlign: 'center', fontSize: '11px', color: '#5AC8FA', fontWeight: 700 }} title="Auto from Boostcamp">↻</span>
                )}
              </div>
            );
          })}
          {best.note && (
            <div style={{ fontSize: '11px', color: 'var(--gray-3)', fontStyle: 'italic', padding: '4px 8px 2px' }}>“{best.note}”</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add form ────────────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  fontSize: '13px', color: 'var(--black)', background: 'var(--gray-6)',
  border: '1px solid var(--sep)', borderRadius: 'var(--r-md)',
  padding: '10px 11px', outline: 'none', minWidth: 0, width: '100%',
};

function AddPRForm({ existingNames, bestByKey, onAdded }: {
  existingNames: string[];
  bestByKey: Map<string, number>;
  onAdded: (created: PR, wasNewBest: boolean) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight]     = useState('');
  const [reps, setReps]         = useState('1');
  const [date, setDate]         = useState(todayLA());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...existingNames, ...SUGGESTED_LIFTS]) {
      const k = n.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(n); }
    }
    return out;
  }, [existingNames]);

  function reset() {
    setExercise(''); setWeight(''); setReps('1'); setDate(todayLA()); setError(null);
  }

  async function submit() {
    const w = Number(weight);
    const r = Number(reps);
    if (!exercise.trim()) { setError('Enter an exercise'); return; }
    if (!Number.isFinite(w) || w <= 0) { setError('Enter a valid weight'); return; }
    if (!Number.isInteger(r) || r <= 0) { setError('Enter valid reps'); return; }

    setSaving(true);
    setError(null);
    try {
      const priorBest = bestByKey.get(exercise.trim().toLowerCase()) ?? 0;
      const wasNewBest = estimate1RM(w, r) > priorBest;

      const res = await fetch('/api/prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise: exercise.trim(), weight_lbs: w, reps: r, achieved_at: `${date}T12:00:00` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Could not save'); return; }

      onAdded(body as PR, wasNewBest);
      reset();
      setOpen(false);
    } catch {
      setError('Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ flexShrink: 0, width: '100%', minHeight: '42px', border: '1px dashed var(--gray-5)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-2)', fontSize: '12px', fontWeight: 800, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      >
        + Add PR manually
      </button>
    );
  }

  return (
    <div style={{ flexShrink: 0, background: 'var(--card)', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <input
        list="pr-lift-suggestions"
        autoFocus
        value={exercise}
        onChange={e => setExercise(e.target.value)}
        placeholder="Exercise (e.g. Deadlift)"
        style={INPUT}
      />
      <datalist id="pr-lift-suggestions">
        {suggestions.map(s => <option key={s} value={s} />)}
      </datalist>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
        <input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" placeholder="Weight (lbs)" style={INPUT} />
        <input value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" placeholder="Reps" style={INPUT} />
      </div>

      <input type="date" value={date} max={todayLA()} onChange={e => setDate(e.target.value)} style={INPUT} />

      {error && <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '7px' }}>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{ flex: 1, minHeight: '42px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--blue)', color: 'var(--bg)', fontSize: '13px', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save PR'}
        </button>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          style={{ width: '46px', minHeight: '42px', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--gray-3)', fontSize: '15px', cursor: 'pointer' }}
        >✕</button>
      </div>
    </div>
  );
}
