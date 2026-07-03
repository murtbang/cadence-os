'use client';


type View = 'dashboard' | 'habits' | 'todos' | 'calendar' | 'settings' | 'notifications' | 'weekly' | 'goals' | 'weather' | 'training' | 'lights';
type IconName = 'dashboard' | 'habits' | 'todos' | 'calendar' | 'weekly' | 'goals' | 'settings' | 'notifications' | 'reload' | 'weather' | 'training' | 'lights';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  unreadCount?: number;
}

const NAV: { id: View; icon: IconName; title: string }[] = [
  { id: 'dashboard',     icon: 'dashboard',     title: 'Dashboard' },
  { id: 'habits',        icon: 'habits',        title: 'Habits' },
  { id: 'todos',         icon: 'todos',         title: 'To-do' },
  { id: 'calendar',      icon: 'calendar',      title: 'Calendar' },
  { id: 'weekly',        icon: 'weekly',        title: 'Weekly Review' },
  { id: 'goals',         icon: 'goals',         title: 'Daily Goals' },
  { id: 'weather',       icon: 'weather',       title: 'Weather' },
  { id: 'training',      icon: 'training',      title: 'Training' },
  { id: 'lights',        icon: 'lights',        title: 'Lights' },
  { id: 'settings',      icon: 'settings',      title: 'Settings' },
  { id: 'notifications', icon: 'notifications', title: 'Notifications' },
];


export default function Sidebar({ activeView, onViewChange, unreadCount = 0 }: SidebarProps) {

  return (
    <aside style={{
      width: '56px',
      flexShrink: 0,
      height: '100dvh',
      background: 'var(--sidebar)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderRight: '0.5px solid var(--sep)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      gap: '3px',
      overflow: 'hidden',
    }}>
      {NAV.map(item => (
        <NavButton
          key={item.id}
          title={item.title}
          icon={item.icon}
          active={activeView === item.id}
          hasDot={item.id === 'notifications' && unreadCount > 0}
          onClick={() => onViewChange(item.id)}
        />
      ))}

      <NavButton
        title="Reload page"
        icon="reload"
        active={false}
        onClick={() => window.location.reload()}
      />
    </aside>
  );
}

function NavButton({ title, icon, active, hasDot, onClick }: { title: string; icon: IconName; active: boolean; hasDot?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      className="sidebar-nav-button"
      data-active={active ? 'true' : 'false'}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        border: 'none',
        color: active ? 'var(--card)' : 'var(--gray-2)',
        background: active ? 'var(--blue)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <SidebarIcon name={icon} />
      {hasDot && (
        <span style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--red)',
          border: '1.5px solid var(--card)',
        }} />
      )}
    </button>
  );
}

function SidebarIcon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'habits') return <svg {...common}><path d="M7 12l3 3 7-7" /><circle cx="12" cy="12" r="9" /></svg>;
  if (name === 'todos') return <svg {...common}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6l1 1 2-2" /><path d="M4 12l1 1 2-2" /><path d="M4 18l1 1 2-2" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></svg>;
  if (name === 'weekly') return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="2.5" height="5" rx="1" /><rect x="12" y="8" width="2.5" height="8" rx="1" /><rect x="17" y="5" width="2.5" height="11" rx="1" /></svg>;
  if (name === 'goals') return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
  if (name === 'weather') return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" /></svg>;
  if (name === 'training') return <svg {...common}><path d="M6 4v16" /><path d="M18 4v16" /><path d="M6 8h12" /><path d="M6 16h12" /><circle cx="4" cy="8" r="2" /><circle cx="4" cy="16" r="2" /><circle cx="20" cy="8" r="2" /><circle cx="20" cy="16" r="2" /></svg>;
  if (name === 'settings') return <svg {...common}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" /></svg>;
  if (name === 'notifications') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
  if (name === 'lights') return <svg {...common}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></svg>;
  return <svg {...common}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>;
}

