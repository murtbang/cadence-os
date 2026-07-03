'use client';

import { useState } from 'react';
import HabitCard from './HabitCard';
import TodoCard from './TodoCard';
import CalendarView from './CalendarView';
import WeeklyReviewView from './WeeklyReviewView';
import GoalsView from './GoalsView';
import WeatherView from './WeatherView';
import TrainingView from './TrainingView';
import NotificationsView from './NotificationsView';
import GoveeCard from './GoveeCard';
import MobileTabBar, { MobileTab } from './MobileTabBar';
import MobileHome from './MobileHome';
import { useCadenceData } from '@/lib/useCadenceData';

type MoreView = 'menu' | 'weekly' | 'goals' | 'weather' | 'training' | 'lights' | 'notifications' | 'settings';

const MORE_ITEMS: { id: MoreView; label: string }[] = [
  { id: 'weekly',        label: 'Weekly Review' },
  { id: 'goals',         label: 'Daily Goals' },
  { id: 'weather',       label: 'Weather' },
  { id: 'training',      label: 'Training' },
  { id: 'lights',        label: 'Lights' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings',      label: 'Settings' },
];

export default function MobileClient({ onSwitchToTablet }: { onSwitchToTablet: () => void }) {
  const d = useCadenceData();
  const [tab, setTab]   = useState<MobileTab>('home');
  const [more, setMore] = useState<MoreView>('menu');

  const inMoreSub = tab === 'more' && more !== 'menu';
  const title = inMoreSub
    ? (MORE_ITEMS.find(m => m.id === more)?.label ?? 'More')
    : TITLES[tab];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', overflow: 'hidden', background: 'var(--bg)',
    }}>
      {/* Header — also clears the notch via safe-area-inset-top */}
      <header style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'var(--sidebar)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '0.5px solid var(--sep)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '46px', padding: '0 8px' }}>
          {inMoreSub && (
            <button
              type="button"
              onClick={() => setMore('menu')}
              aria-label="Back"
              style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '40px', padding: '0 6px', background: 'transparent', border: 'none', color: 'var(--blue)', fontSize: '15px', fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              More
            </button>
          )}
          <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--black)', marginLeft: inMoreSub ? 'auto' : '4px', marginRight: inMoreSub ? 'auto' : '0' }}>
            {title}
          </span>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'home' && (
          <Scroll>
            <MobileHome
              nextEvent={d.nextEvent}
              habits={d.habits}
              habitLogs={d.habitLogs}
              onToggleHabit={d.handleToggleHabit}
              onOpenTab={setTab}
            />
          </Scroll>
        )}

        {tab === 'habits' && (
          <Fill>
            <HabitCard
              habits={d.habits}
              logs={d.habitLogs}
              onToggle={d.handleToggleHabit}
              onSkip={d.handleSkipHabit}
              onAddHabit={d.handleAddHabit}
              onDeleteHabit={d.handleDeleteHabit}
              onEditHabit={d.handleEditHabit}
              onRestoreHabit={d.handleRestoreHabit}
              showFull
            />
          </Fill>
        )}

        {tab === 'todos' && (
          <Fill>
            <TodoCard
              todos={d.todos}
              categories={d.categories}
              onToggle={d.handleToggleTodo}
              onReorder={d.handleReorderTodo}
              onAdd={d.handleAddTodo}
              onDelete={d.handleDeleteTodo}
              onEdit={d.handleEditTodo}
              onAddCategory={d.handleAddCategory}
              onRenameCategory={d.handleRenameCategory}
              onDeleteCategory={d.handleDeleteCategory}
            />
          </Fill>
        )}

        {tab === 'calendar' && (
          <Fill><CalendarView events={d.events} /></Fill>
        )}

        {tab === 'more' && more === 'menu' && (
          <MoreMenu
            unreadCount={d.unreadCount}
            onSelect={setMore}
            onSwitchToTablet={onSwitchToTablet}
          />
        )}
        {tab === 'more' && more === 'weekly'   && <Fill><WeeklyReviewView /></Fill>}
        {tab === 'more' && more === 'goals'    && <Fill><GoalsView /></Fill>}
        {tab === 'more' && more === 'weather'  && <Fill><WeatherView /></Fill>}
        {tab === 'more' && more === 'training' && <Fill><TrainingView /></Fill>}
        {tab === 'more' && more === 'lights'   && <Fill><GoveeCard /></Fill>}
        {tab === 'more' && more === 'notifications' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <NotificationsView
              notifications={d.notifications}
              onMarkRead={d.handleMarkRead}
              onDelete={d.handleDeleteNotif}
              onClearAll={d.handleClearAll}
            />
          </div>
        )}
        {tab === 'more' && more === 'settings' && (
          <Scroll>
            <SettingsPanel onSwitchToTablet={onSwitchToTablet} />
          </Scroll>
        )}
      </main>

      <MobileTabBar
        active={tab}
        unreadCount={d.unreadCount}
        onChange={t => { setTab(t); if (t === 'more') setMore('menu'); }}
      />
    </div>
  );
}

const TITLES: Record<MobileTab, string> = {
  home: 'Cadence',
  habits: 'Habits',
  todos: 'To-do',
  calendar: 'Calendar',
  more: 'More',
};

// ── Layout helpers ──────────────────────────────────────────────────────────────

/** Flex frame for cards that fill the space between header and tab bar and
 *  scroll inside themselves. */
function Fill({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '6px' }}>{children}</div>;
}

/** Scrolling frame for free-flowing content (Home, Settings, More menu). */
function Scroll({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>;
}

// ── More menu ───────────────────────────────────────────────────────────────────

function MoreMenu({ unreadCount, onSelect, onSwitchToTablet }: {
  unreadCount: number;
  onSelect: (v: MoreView) => void;
  onSwitchToTablet: () => void;
}) {
  return (
    <Scroll>
      <div style={{ padding: '10px 10px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          background: 'var(--card)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--sep)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
        }}>
          {MORE_ITEMS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: '52px', padding: '0 16px', cursor: 'pointer',
                background: 'transparent', color: 'var(--gray-1)',
                border: 'none', borderTop: i === 0 ? 'none' : '0.5px solid var(--sep)',
                fontSize: '15px', fontWeight: 650, textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span>{item.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span style={{ minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: 'var(--r-pill)', background: 'var(--red)', color: 'var(--bg)', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSwitchToTablet}
          style={{
            width: '100%', marginTop: '6px', minHeight: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            background: 'var(--card)', border: '1px solid var(--sep)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)',
            color: 'var(--blue)', fontSize: '15px', fontWeight: 750, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 18v3" /></svg>
          Switch to Tablet view
        </button>
      </div>
    </Scroll>
  );
}

function SettingsPanel({ onSwitchToTablet }: { onSwitchToTablet: () => void }) {
  return (
    <div style={{ padding: '12px 10px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', padding: '18px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--sep)', fontSize: '12.5px', color: 'var(--gray-3)', lineHeight: 1.7 }}>
        Cadence — personal daily OS<br />
        Polls every 10s — Your City<br />
        AM to PM flip at 5:00 PM
      </div>
      <button
        type="button"
        onClick={onSwitchToTablet}
        style={{ width: '100%', minHeight: '50px', background: 'transparent', border: '1px solid var(--sep)', borderRadius: 'var(--r-lg)', color: 'var(--blue)', fontSize: '14px', fontWeight: 750, cursor: 'pointer' }}
      >
        Switch to Tablet view
      </button>
    </div>
  );
}
