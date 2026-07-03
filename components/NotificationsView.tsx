'use client';

import { Notification } from '@/types/database';

const TYPE_ICON: Record<string, string> = {
  info:     '💬',
  habit:    '🔁',
  calendar: '📅',
  todo:     '✅',
  note:     '📌',
  silent:   '🪵',
};

interface Props {
  notifications: Notification[];
  onMarkRead:    (id: string) => Promise<void>;
  onDelete:      (id: string) => Promise<void>;
  onClearAll:    () => Promise<void>;
}

export default function NotificationsView({ notifications, onMarkRead, onDelete, onClearAll }: Props) {
  const unread = notifications.filter(n => !n.read && n.type !== 'silent').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--black)' }}>
          Notifications {unread > 0 && (
            <span style={{
              marginLeft: '6px',
              fontSize: '10px',
              fontWeight: 700,
              background: 'var(--red)',
              color: 'var(--bg)',
              borderRadius: 'var(--r-pill)',
              padding: '1px 6px',
              verticalAlign: 'middle',
            }}>{unread}</span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            style={{ fontSize: '11px', color: 'var(--gray-4)', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', minWidth: '44px', WebkitTapHighlightColor: 'transparent' }}
          >
            Clear all
          </button>
        )}
      </div>

      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow)',
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '680px',
      }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '20px', fontSize: '13px', color: 'var(--gray-3)' }}>
            No notifications yet.
          </div>
        ) : (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            {notifications.map((n, idx) => {
              const isSilent = n.type === 'silent';
              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: isSilent ? '7px 16px' : '10px 16px',
                    borderBottom: idx < notifications.length - 1 ? '0.5px solid var(--sep)' : 'none',
                    background: isSilent ? 'transparent' : (n.read ? 'transparent' : 'rgba(0,113,227,0.04)'),
                    flexShrink: 0,
                    opacity: isSilent ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: isSilent ? '12px' : '16px', flexShrink: 0, marginTop: '1px' }}>
                    {TYPE_ICON[n.type] ?? '💬'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isSilent ? '11px' : '13px',
                      color: isSilent ? 'var(--gray-3)' : (n.read ? 'var(--gray-3)' : 'var(--gray-1)'),
                      fontWeight: isSilent ? 400 : (n.read ? 400 : 500),
                      lineHeight: 1.4,
                      fontFamily: isSilent ? 'monospace' : 'inherit',
                    }}>
                      {n.message}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0', flexShrink: 0 }}>
                    {!isSilent && !n.read && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        style={{ fontSize: '11px', color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', minWidth: '44px', minHeight: '44px', WebkitTapHighlightColor: 'transparent' }}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(n.id)}
                      style={{ fontSize: '18px', color: 'var(--gray-4)', background: 'none', border: 'none', cursor: 'pointer', minWidth: '44px', minHeight: '44px', WebkitTapHighlightColor: 'transparent' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
