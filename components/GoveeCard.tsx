'use client';

import { useEffect, useState } from 'react';

interface Device {
  device:       string;
  model:        string;
  deviceName:   string;
  controllable: boolean;
  supportCmds:  string[];
}

async function sendCmd(device: string, model: string, name: string, value: unknown) {
  await fetch('/api/govee/control', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ device, model, cmd: { name, value } }),
  });
}

const GOVEE_DELAY_MS = 200; // gap between commands to avoid rate limiting

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Send commands to one device sequentially with a small gap between each
async function applySeq(device: string, model: string, cmds: [string, unknown][]) {
  for (const [name, value] of cmds) {
    await sendCmd(device, model, name, value);
    await delay(GOVEE_DELAY_MS);
  }
}

// Send a full shortcut to all devices sequentially (one device at a time)
async function applyAll(devices: Device[], getCmds: (d: Device) => [string, unknown][]) {
  for (const d of devices) {
    await applySeq(d.device, d.model, getCmds(d));
    await delay(GOVEE_DELAY_MS);
  }
}

function isBulb(d: Device) {
  const n = d.deviceName.toLowerCase();
  return n.includes('bulb') || n.includes('led');
}

const SHORTCUTS = [
  {
    id:    'work',
    label: 'Work On',
    sub:   'Brightest',
    emoji: '💼',
    color: '#5AC8FA',
    apply: (devices: Device[]) => applyAll(devices, d => {
      const supportsColorTem = d.supportCmds.includes('colorTem');
      return [
        ['turn', 'on'],
        ['brightness', 100],
        supportsColorTem ? ['colorTem', 6500] : ['color', { r: 255, g: 255, b: 255 }],
      ];
    }),
  },
  {
    id:    'warm',
    label: 'Warm',
    sub:   'Cozy mode',
    emoji: '🌅',
    color: 'var(--orange)',
    apply: (devices: Device[]) => applyAll(devices, d => {
      const supportsColorTem = d.supportCmds.includes('colorTem');
      if (isBulb(d)) return [
        ['turn', 'on'],
        ['brightness', 90],
        supportsColorTem ? ['colorTem', 3000] : ['color', { r: 255, g: 147, b: 41 }],
      ];
      return [
        ['turn', 'on'],
        ['brightness', 50],
        supportsColorTem ? ['colorTem', 2700] : ['color', { r: 255, g: 120, b: 20 }],
      ];
    }),
  },
  {
    id:    'off',
    label: 'Lights Off',
    sub:   'All off',
    emoji: '🌙',
    color: 'var(--gray-3)',
    apply: (devices: Device[]) => applyAll(devices, () => [['turn', 'off']]),
  },
] as const;

type ShortcutId = typeof SHORTCUTS[number]['id'];

export default function GoveeCard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [active,  setActive]  = useState<ShortcutId | null>(null);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    fetch('/api/govee/devices', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDevices(data.filter((d: Device) => d.controllable));
        }
      })
      .catch(() => {});
  }, []);

  async function tap(shortcut: typeof SHORTCUTS[number]) {
    if (busy) return;
    setBusy(true);
    setActive(shortcut.id);
    try {
      await shortcut.apply(devices);
    } catch (err) {
      console.error('govee shortcut error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{
      background:    'var(--card)',
      borderRadius:  'var(--r-lg)',
      boxShadow:     'var(--shadow)',
      border:        '1px solid var(--sep)',
      padding:       '14px 12px 30px',  // 30px bottom clears the flip dots
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      height:        '100%',
      boxSizing:     'border-box',
    }}>

      {/* Header */}
      <div style={{
        fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--gray-4)', flexShrink: 0,
      }}>
        Lights
      </div>

      {/* 3 shortcut buttons — side by side, fill remaining height */}
      <div style={{ flex: 1, display: 'flex', gap: '7px', minHeight: 0 }}>
        {SHORTCUTS.map(s => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => tap(s)}
              disabled={busy}
              style={{
                flex:                   1,
                display:                'flex',
                flexDirection:          'column',
                alignItems:             'center',
                justifyContent:         'center',
                gap:                    '9px',
                border:                 `1.5px solid ${isActive ? s.color : 'var(--sep)'}`,
                borderRadius:           'var(--r-lg)',
                background:             isActive ? `${s.color}1a` : 'var(--gray-6)',
                cursor:                 busy ? 'default' : 'pointer',
                opacity:                busy && !isActive ? 0.6 : 1,
                transition:             'border-color 0.2s, background 0.2s',
                WebkitTapHighlightColor: 'transparent',
                boxShadow:              isActive ? `0 0 16px ${s.color}30` : 'none',
              }}
            >
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{s.emoji}</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize:      '11px',
                  fontWeight:    800,
                  color:         isActive ? s.color : 'var(--gray-1)',
                  letterSpacing: '-0.2px',
                  lineHeight:    1.2,
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize:   '9px',
                  fontWeight: 600,
                  color:      isActive ? s.color : 'var(--gray-4)',
                  marginTop:  '2px',
                  opacity:    0.8,
                }}>
                  {s.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
