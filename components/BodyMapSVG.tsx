'use client';

// Fixed color per muscle region — independent of workout classification color
const REGION_COLOR: Record<string, string> = {
  // Red — chest & core
  'front-chest-l':   '#FF3B30',
  'front-chest-r':   '#FF3B30',
  'front-abs':       '#FF3B30',
  // Orange — push (shoulders, triceps)
  'front-shoulder-l':'var(--orange)',
  'front-shoulder-r':'var(--orange)',
  'back-shoulder-l': 'var(--orange)',
  'back-shoulder-r': 'var(--orange)',
  'back-tricep-l':   'var(--orange)',
  'back-tricep-r':   'var(--orange)',
  // Blue — pull (back, biceps, traps, rear delts, forearms)
  'front-bicep-l':   '#5AC8FA',
  'front-bicep-r':   '#5AC8FA',
  'front-forearm-l': '#5AC8FA',
  'front-forearm-r': '#5AC8FA',
  'front-trap-l':    '#5AC8FA',
  'front-trap-r':    '#5AC8FA',
  'back-forearm-l':  '#5AC8FA',
  'back-forearm-r':  '#5AC8FA',
  'back-lat-l':      '#5AC8FA',
  'back-lat-r':      '#5AC8FA',
  'back-trap-l':     '#5AC8FA',
  'back-trap-r':     '#5AC8FA',
  // Green — legs
  'front-quad-l':    '#34C759',
  'front-quad-r':    '#34C759',
  'back-hamstring-l':'#34C759',
  'back-hamstring-r':'#34C759',
  'back-glute-l':    '#34C759',
  'back-glute-r':    '#34C759',
  'back-calf-l':     '#34C759',
  'back-calf-r':     '#34C759',
};

const COMPOUND_MUSCLES = new Set(['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes']);

const MUSCLE_TO_REGIONS: Record<string, string[]> = {
  chest:        ['front-chest-l', 'front-chest-r'],
  shoulders:    ['front-shoulder-l', 'front-shoulder-r', 'back-shoulder-l', 'back-shoulder-r'],
  triceps:      ['back-tricep-l', 'back-tricep-r'],
  biceps:       ['front-bicep-l', 'front-bicep-r', 'front-forearm-l', 'front-forearm-r', 'back-forearm-l', 'back-forearm-r'],
  back:         ['back-lat-l', 'back-lat-r', 'back-trap-l', 'back-trap-r'],
  // traps: front (upper trap visible from front) + back (full trap)
  traps:        ['front-trap-l', 'front-trap-r', 'back-trap-l', 'back-trap-r'],
  'rear delts': ['back-shoulder-l', 'back-shoulder-r'],
  quads:        ['front-quad-l', 'front-quad-r'],
  hamstrings:   ['back-hamstring-l', 'back-hamstring-r'],
  glutes:       ['back-glute-l', 'back-glute-r'],
  calves:       ['back-calf-l', 'back-calf-r'],
  forearms:     ['front-forearm-l', 'front-forearm-r', 'back-forearm-l', 'back-forearm-r'],
};

function getActiveRegions(muscles: string[]): Set<string> {
  const active = new Set<string>();
  let hasCompound = false;

  for (const m of muscles) {
    const key = m.toLowerCase();
    const regions = MUSCLE_TO_REGIONS[key];
    if (regions) regions.forEach(r => active.add(r));
    if (COMPOUND_MUSCLES.has(key)) hasCompound = true;
  }

  if (hasCompound) active.add('front-abs');

  return active;
}

interface BodyMapSVGProps {
  muscles: string[];
  accentColor?: string;
  size?: number;
}

export default function BodyMapSVG({ muscles, size = 130 }: BodyMapSVGProps) {
  const active  = getActiveRegions(muscles);
  const h       = size * 2.2;
  const passive = '#d4d4d4';

  function fill(id: string)    { return active.has(id) ? (REGION_COLOR[id] ?? '#aaa') : passive; }
  function opacity(id: string) { return active.has(id) ? 0.88 : 0.3; }

  const vw = 130;
  const vh = 220;

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={size} height={h} style={{ overflow: 'visible' }}>

      {/* ── FRONT (left, x=0) ─────────────────────────────────────── */}
      <g transform="translate(0,0)">
        {/* Head */}
        <ellipse cx="30" cy="14" rx="10" ry="12" fill={passive} opacity="0.35" />
        {/* Neck */}
        <rect x="26" y="24" width="8" height="7" rx="3" fill={passive} opacity="0.35" />

        {/* Upper traps (front-visible — the slope from neck to shoulder) */}
        <path id="front-trap-l" d="M26,27 Q20,29 14,33 L14,37 Q21,33 27,30 Z"
              fill={fill('front-trap-l')} opacity={opacity('front-trap-l')} />
        <path id="front-trap-r" d="M34,27 Q40,29 46,33 L46,37 Q39,33 33,30 Z"
              fill={fill('front-trap-r')} opacity={opacity('front-trap-r')} />

        {/* Shoulders */}
        <ellipse id="front-shoulder-l" cx="14" cy="34" rx="6" ry="7" fill={fill('front-shoulder-l')} opacity={opacity('front-shoulder-l')} />
        <ellipse id="front-shoulder-r" cx="46" cy="34" rx="6" ry="7" fill={fill('front-shoulder-r')} opacity={opacity('front-shoulder-r')} />

        {/* Chest */}
        <path id="front-chest-l" d="M18,31 Q14,39 16,46 Q22,49 30,47 L30,31 Z" fill={fill('front-chest-l')} opacity={opacity('front-chest-l')} />
        <path id="front-chest-r" d="M42,31 Q46,39 44,46 Q38,49 30,47 L30,31 Z" fill={fill('front-chest-r')} opacity={opacity('front-chest-r')} />

        {/* Biceps */}
        <rect id="front-bicep-l" x="8" y="41" width="8" height="20" rx="4" fill={fill('front-bicep-l')} opacity={opacity('front-bicep-l')} />
        <rect id="front-bicep-r" x="44" y="41" width="8" height="20" rx="4" fill={fill('front-bicep-r')} opacity={opacity('front-bicep-r')} />

        {/* Forearms */}
        <rect id="front-forearm-l" x="9" y="62" width="7" height="22" rx="3.5" fill={fill('front-forearm-l')} opacity={opacity('front-forearm-l')} />
        <rect id="front-forearm-r" x="44" y="62" width="7" height="22" rx="3.5" fill={fill('front-forearm-r')} opacity={opacity('front-forearm-r')} />

        {/* Abs / core */}
        <rect id="front-abs" x="22" y="47" width="16" height="26" rx="4" fill={fill('front-abs')} opacity={opacity('front-abs')} />

        {/* Quads */}
        <rect id="front-quad-l" x="18" y="74" width="10" height="36" rx="5" fill={fill('front-quad-l')} opacity={opacity('front-quad-l')} />
        <rect id="front-quad-r" x="32" y="74" width="10" height="36" rx="5" fill={fill('front-quad-r')} opacity={opacity('front-quad-r')} />

        {/* Shins */}
        <rect x="19" y="111" width="9" height="28" rx="4" fill={passive} opacity="0.25" />
        <rect x="32" y="111" width="9" height="28" rx="4" fill={passive} opacity="0.25" />

        <text x="30" y="146" textAnchor="middle" fontSize="5" fill="#bbb" fontWeight="700" letterSpacing="0.5">FRONT</text>
      </g>

      {/* ── BACK (right, x=70) ─────────────────────────────────────── */}
      <g transform="translate(70,0)">
        {/* Head */}
        <ellipse cx="30" cy="14" rx="10" ry="12" fill={passive} opacity="0.35" />
        {/* Neck */}
        <rect x="26" y="24" width="8" height="7" rx="3" fill={passive} opacity="0.35" />

        {/* Traps — wider, anatomically fuller shape covering upper + mid back */}
        <path id="back-trap-l"
              d="M29,27 Q22,28 14,33 L14,41 Q19,43 26,40 L28,38 L29,37 Z"
              fill={fill('back-trap-l')} opacity={opacity('back-trap-l')} />
        <path id="back-trap-r"
              d="M31,27 Q38,28 46,33 L46,41 Q41,43 34,40 L32,38 L31,37 Z"
              fill={fill('back-trap-r')} opacity={opacity('back-trap-r')} />

        {/* Shoulders (rear delts) */}
        <ellipse id="back-shoulder-l" cx="14" cy="34" rx="6" ry="7" fill={fill('back-shoulder-l')} opacity={opacity('back-shoulder-l')} />
        <ellipse id="back-shoulder-r" cx="46" cy="34" rx="6" ry="7" fill={fill('back-shoulder-r')} opacity={opacity('back-shoulder-r')} />

        {/* Triceps */}
        <rect id="back-tricep-l" x="8" y="41" width="8" height="20" rx="4" fill={fill('back-tricep-l')} opacity={opacity('back-tricep-l')} />
        <rect id="back-tricep-r" x="44" y="41" width="8" height="20" rx="4" fill={fill('back-tricep-r')} opacity={opacity('back-tricep-r')} />

        {/* Forearms (back) */}
        <rect id="back-forearm-l" x="9" y="62" width="7" height="22" rx="3.5" fill={fill('back-forearm-l')} opacity={opacity('back-forearm-l')} />
        <rect id="back-forearm-r" x="44" y="62" width="7" height="22" rx="3.5" fill={fill('back-forearm-r')} opacity={opacity('back-forearm-r')} />

        {/* Lats */}
        <path id="back-lat-l" d="M18,31 Q12,46 16,61 Q22,65 28,63 L28,47 Z" fill={fill('back-lat-l')} opacity={opacity('back-lat-l')} />
        <path id="back-lat-r" d="M42,31 Q48,46 44,61 Q38,65 32,63 L32,47 Z" fill={fill('back-lat-r')} opacity={opacity('back-lat-r')} />

        {/* Lower back */}
        <rect x="22" y="63" width="16" height="10" rx="4" fill={passive} opacity="0.25" />

        {/* Glutes */}
        <ellipse id="back-glute-l" cx="22" cy="79" rx="8" ry="8" fill={fill('back-glute-l')} opacity={opacity('back-glute-l')} />
        <ellipse id="back-glute-r" cx="38" cy="79" rx="8" ry="8" fill={fill('back-glute-r')} opacity={opacity('back-glute-r')} />

        {/* Hamstrings */}
        <rect id="back-hamstring-l" x="18" y="87" width="10" height="27" rx="5" fill={fill('back-hamstring-l')} opacity={opacity('back-hamstring-l')} />
        <rect id="back-hamstring-r" x="32" y="87" width="10" height="27" rx="5" fill={fill('back-hamstring-r')} opacity={opacity('back-hamstring-r')} />

        {/* Calves */}
        <rect id="back-calf-l" x="19" y="115" width="9" height="24" rx="4.5" fill={fill('back-calf-l')} opacity={opacity('back-calf-l')} />
        <rect id="back-calf-r" x="32" y="115" width="9" height="24" rx="4.5" fill={fill('back-calf-r')} opacity={opacity('back-calf-r')} />

        <text x="30" y="146" textAnchor="middle" fontSize="5" fill="#bbb" fontWeight="700" letterSpacing="0.5">BACK</text>
      </g>
    </svg>
  );
}
