'use client';

import { useState, useCallback, useEffect } from 'react';
import { IonCheckbox, IonReorder, IonReorderGroup, ItemReorderEventDetail } from '@ionic/react';
import { Todo, TodoCategory } from '@/types/database';

interface TodoCardProps {
  todos: Todo[];
  categories: TodoCategory[];
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onReorder: (id: string, newOrder: number) => Promise<void>;
  onAdd: (text: string, priority: 'high' | 'low', category: string, dueDate: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, text: string, priority: 'high' | 'low', dueDate: string | null) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onRenameCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onNavigate?: () => void;
}

// Timed todos float to the top of their section by urgency (overdue → soonest);
// untimed todos keep their manual drag order below.
function sortByDue(arr: Todo[]): Todo[] {
  return [...arr].sort((a, b) => {
    const ad = a.due_date, bd = b.due_date;
    if (ad && bd) return ad < bd ? -1 : ad > bd ? 1 : a.order - b.order;
    if (ad) return -1;            // a is timed, b is not → a first
    if (bd) return 1;             // b is timed, a is not → b first
    return a.order - b.order;     // both untimed → manual order
  });
}

function fmtDue(date: string)     { return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtWeekday(date: string) { return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }

function DueBadge({ date, completed }: { date: string; completed: boolean }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const days  = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86_400_000);
  let label: string; let color: string;
  if (completed)       { label = fmtDue(date);     color = 'var(--gray-4)'; }
  else if (days < 0)   { label = 'Overdue';        color = 'var(--red)';    }
  else if (days === 0) { label = 'Due today';      color = 'var(--red)';    }
  else if (days === 1) { label = 'Tomorrow';       color = 'var(--orange)'; }
  else if (days <= 6)  { label = fmtWeekday(date); color = 'var(--gray-3)'; }
  else                 { label = fmtDue(date);     color = 'var(--gray-3)'; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 750, color }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
      {label}
    </span>
  );
}

export default function TodoCard({ todos, categories, onToggle, onReorder, onAdd, onDelete, onEdit, onAddCategory, onRenameCategory, onDeleteCategory, onNavigate }: TodoCardProps) {
  // Effective category tabs. Use the managed list, but ALSO surface any category
  // that appears on a todo yet isn't managed (e.g. before the DB migration runs)
  // so lists are never hidden. Matching is case-insensitive for the same reason.
  const norm = (s: string) => (s ?? '').trim().toLowerCase();
  const managedNames = new Set(categories.map(c => norm(c.name)));
  const orphanCats = Array.from(new Set(todos.map(t => t.category).filter(Boolean) as string[]))
    .filter(n => !managedNames.has(norm(n)))
    .map((name, i): TodoCategory => ({ id: `orphan:${name}`, name, color: 'var(--gray-3)', order: 900 + i, created_at: '' }));
  const cats = [...categories, ...orphanCats];
  if (cats.length === 0) cats.push({ id: 'seed:Personal', name: 'Personal', color: 'var(--blue)', order: 0, created_at: '' });
  const firstCat = cats[0].name;
  const [activeTab, setActiveTab] = useState<string>(firstCat);
  const [addingPriority, setAddingPriority] = useState<'high' | 'low' | null>(null);
  const [newText, setNewText] = useState('');
  const [newDue,  setNewDue]  = useState('');
  // Category management
  const [addingCat,     setAddingCat]     = useState(false);
  const [newCatName,    setNewCatName]    = useState('');
  const [managing,      setManaging]      = useState(false);
  const [renameId,      setRenameId]      = useState<string | null>(null);
  const [renameText,    setRenameText]    = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TodoCategory | null>(null);

  // Snap to a valid category on load or when the active one is deleted.
  useEffect(() => {
    if (cats.length && !cats.some(c => norm(c.name) === norm(activeTab))) {
      setActiveTab(cats[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, todos, activeTab]);

  // Reset add form when switching tabs
  useEffect(() => {
    setAddingPriority(null);
    setNewText('');
    setNewDue('');
  }, [activeTab]);

  const tabTodos  = todos.filter(t => norm(t.category ?? firstCat) === norm(activeTab));
  const high      = sortByDue(tabTodos.filter(t => t.priority === 'high' && !t.completed));
  const low       = sortByDue(tabTodos.filter(t => t.priority === 'low'  && !t.completed));
  const done      = [
    ...tabTodos.filter(t => t.priority === 'high' && t.completed).sort((a, b) => a.order - b.order),
    ...tabTodos.filter(t => t.priority === 'low'  && t.completed).sort((a, b) => a.order - b.order),
  ];

  const totalOpen = todos.filter(t => !t.completed).length;
  const tabOpen   = tabTodos.filter(t => !t.completed).length;
  const [showDone, setShowDone] = useState(false);

  // Reset showDone when switching tabs
  useEffect(() => { setShowDone(false); }, [activeTab]);

  function handleReorder(event: CustomEvent<ItemReorderEventDetail>, list: Todo[]) {
    const reordered = event.detail.complete(list) as Todo[];
    reordered.forEach((t, i) => onReorder(t.id, i));
  }

  const handleAdd = useCallback(async () => {
    if (!newText.trim() || !addingPriority) return;
    await onAdd(newText.trim(), addingPriority, activeTab, newDue || null);
    setNewText('');
    setNewDue('');
    setAddingPriority(null);
  }, [newText, newDue, addingPriority, activeTab, onAdd]);

  const activeColor = cats.find(c => norm(c.name) === norm(activeTab))?.color ?? 'var(--blue)';

  async function submitAddCat() {
    const n = newCatName.trim();
    if (!n) return;
    await onAddCategory(n);
    setNewCatName(''); setAddingCat(false); setActiveTab(n);
  }
  async function submitRename(id: string) {
    const n = renameText.trim();
    if (n) { await onRenameCategory(id, n); setActiveTab(n); }
    setRenameId(null);
  }
  async function doDeleteCat(cat: TodoCategory) {
    await onDeleteCategory(cat.id);
    setConfirmDelete(null);
  }

  return (
    <section style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)', border: '1px solid var(--sep)', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>To-do</span>
            <span style={{ color: totalOpen > 0 ? 'var(--blue)' : 'var(--green)', fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-geist-mono), monospace' }}>{totalOpen} open</span>
          </div>
          {onNavigate && (
            <button type="button" onClick={onNavigate} style={{ color: 'var(--gray-3)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-pill)', padding: '6px 10px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}>
              Open
            </button>
          )}
        </div>

        {/* ── Category tabs (dynamic) ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '0', overflowX: 'auto', alignItems: 'stretch' }}>
          {cats.map(cat => {
            const count   = todos.filter(t => norm(t.category ?? firstCat) === norm(cat.name) && !t.completed).length;
            const active  = norm(activeTab) === norm(cat.name);
            const managed = !cat.id.startsWith('orphan:') && !cat.id.startsWith('seed:');

            if (managing && renameId === cat.id) {
              return (
                <input key={cat.id} autoFocus value={renameText}
                  onChange={e => setRenameText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitRename(cat.id); if (e.key === 'Escape') setRenameId(null); }}
                  onBlur={() => submitRename(cat.id)}
                  style={{ flexShrink: 0, minHeight: '34px', width: '96px', fontSize: '11px', fontWeight: 800, color: 'var(--black)', background: 'var(--gray-6)', border: `1.5px solid ${cat.color}`, borderRadius: 'var(--r-md) var(--r-md) 0 0', padding: '0 8px', outline: 'none' }} />
              );
            }

            return (
              <button key={cat.id} type="button"
                onClick={() => { if (managing && managed) { setRenameId(cat.id); setRenameText(cat.name); } else if (!managing) setActiveTab(cat.name); }}
                style={{
                  flexShrink: 0, minHeight: '34px', padding: '0 12px', border: 'none',
                  borderRadius: 'var(--r-md) var(--r-md) 0 0',
                  background: active ? cat.color : 'var(--gray-6)',
                  color: active ? '#fff' : 'var(--gray-3)',
                  fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'background 0.15s, color 0.15s', WebkitTapHighlightColor: 'transparent',
                }}
              >
                {cat.name}
                {count > 0 && (
                  <span style={{ fontSize: '9px', fontWeight: 900, background: active ? 'rgba(255,255,255,0.25)' : 'var(--gray-5)', color: active ? '#fff' : 'var(--gray-3)', borderRadius: 'var(--r-pill)', padding: '1px 5px', fontFamily: 'var(--font-geist-mono), monospace', lineHeight: 1.6 }}>{count}</span>
                )}
                {managing && managed && (
                  <span onClick={e => { e.stopPropagation(); setConfirmDelete(cat); }} title="Delete category"
                    style={{ marginLeft: '2px', fontSize: '13px', lineHeight: 1, opacity: 0.85 }}>×</span>
                )}
              </button>
            );
          })}

          {!managing && (
            <button type="button" onClick={() => { setAddingCat(v => !v); setNewCatName(''); }} title="Add category"
              style={{ flexShrink: 0, minHeight: '34px', minWidth: '34px', border: '1px dashed var(--gray-5)', borderRadius: 'var(--r-md) var(--r-md) 0 0', background: 'transparent', color: 'var(--gray-3)', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}>＋</button>
          )}

          {categories.length > 0 && (
            <button type="button" onClick={() => { setManaging(v => !v); setRenameId(null); setAddingCat(false); }} title="Edit categories"
              style={{ flexShrink: 0, minHeight: '34px', minWidth: '38px', border: 'none', borderRadius: 'var(--r-md) var(--r-md) 0 0', background: managing ? 'var(--blue)' : 'var(--gray-6)', color: managing ? '#fff' : 'var(--gray-3)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
              {managing ? 'Done' : '✎'}
            </button>
          )}
        </div>

        {addingCat && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category name"
              onKeyDown={e => { if (e.key === 'Enter') submitAddCat(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }}
              style={{ flex: 1, minHeight: '38px', fontSize: '12px', color: 'var(--black)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '0 10px', outline: 'none', minWidth: 0 }} />
            <button type="button" onClick={submitAddCat} style={{ minHeight: '38px', padding: '0 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--blue)', color: 'var(--bg)', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>Add</button>
          </div>
        )}

        {confirmDelete && (
          <div style={{ marginTop: '6px', padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--gray-6)', border: '1px solid var(--red)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-1)', marginBottom: '7px', lineHeight: 1.4 }}>
              Delete “{confirmDelete.name}”? Its tasks move to “{categories.find(c => c.id !== confirmDelete.id)?.name ?? 'Personal'}”.
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => doDeleteCat(confirmDelete)} style={{ fontSize: '11px', fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer' }}>Delete</button>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ fontSize: '11px', fontWeight: 800, padding: '5px 14px', borderRadius: 'var(--r-pill)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--gray-3)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ height: '2px', background: activeColor, borderRadius: '0 0 2px 2px', marginBottom: '2px', marginTop: '2px' }} />
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 8px 8px' }}>

        <TodoSection label="High" tone="var(--red)" top={false}>
          <IonReorderGroup disabled={false} onIonItemReorder={e => handleReorder(e, high)} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {high.map(todo => (
              <TodoRow key={todo.id} todo={todo} tone="var(--red)" onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </IonReorderGroup>
          {addingPriority === 'high' ? (
            <AddRow value={newText} due={newDue} onChange={setNewText} onDueChange={setNewDue} onConfirm={handleAdd} onCancel={() => { setAddingPriority(null); setNewText(''); setNewDue(''); }} />
          ) : (
            <AddButton label="+ Add high" onClick={() => setAddingPriority('high')} />
          )}
        </TodoSection>

        <TodoSection label="Low" tone="var(--gray-3)" top>
          <IonReorderGroup disabled={false} onIonItemReorder={e => handleReorder(e, low)} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {low.map(todo => (
              <TodoRow key={todo.id} todo={todo} tone="var(--blue)" onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </IonReorderGroup>
          {addingPriority === 'low' ? (
            <AddRow value={newText} due={newDue} onChange={setNewText} onDueChange={setNewDue} onConfirm={handleAdd} onCancel={() => { setAddingPriority(null); setNewText(''); setNewDue(''); }} />
          ) : (
            <AddButton label="+ Add low" onClick={() => setAddingPriority('low')} />
          )}
        </TodoSection>

        {/* ── Done / Previous ─────────────────────────────────────────────── */}
        {done.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => setShowDone(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', width: '100%', minHeight: '44px', WebkitTapHighlightColor: 'transparent' }}
            >
              <span style={{ fontSize: '11px', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                Previous ({done.length})
              </span>
              <span style={{ fontSize: '14px', color: 'var(--gray-4)', marginLeft: 'auto', transition: 'transform 0.2s', display: 'inline-block', transform: showDone ? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {showDone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {done.map(todo => (
                  <DoneRow key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {tabTodos.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-4)', fontSize: '12px', fontWeight: 600 }}>
            No tasks yet
          </div>
        )}
      </div>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TodoSection({ label, tone, top, children }: { label: string; tone: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: top ? '10px' : '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 4px 5px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tone }} />
        <span style={{ fontSize: '9px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: tone }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button type="button" onClick={handleCopy} aria-label="Copy" title="Copy"
      style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'transparent', color: copied ? 'var(--green)' : 'var(--gray-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', transition: 'color 0.15s' }}>
      {copied
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
    </button>
  );
}

function TodoRow({ todo, tone, onToggle, onDelete, onEdit }: {
  todo: Todo; tone: string;
  onToggle: TodoCardProps['onToggle']; onDelete: TodoCardProps['onDelete']; onEdit: TodoCardProps['onEdit'];
}) {
  const [editing,      setEditing]      = useState(false);
  const [editText,     setEditText]     = useState(todo.text);
  const [editPriority, setEditPriority] = useState<'high' | 'low'>(todo.priority);
  const [editDue,      setEditDue]      = useState(todo.due_date ?? '');

  useEffect(() => {
    if (!editing) { setEditText(todo.text); setEditPriority(todo.priority); setEditDue(todo.due_date ?? ''); }
  }, [todo.text, todo.priority, todo.due_date, editing]);

  const save = async () => {
    if (!editText.trim()) return;
    await onEdit(todo.id, editText.trim(), editPriority, editDue || null);
    setEditing(false);
  };
  const cancel = () => { setEditText(todo.text); setEditPriority(todo.priority); setEditDue(todo.due_date ?? ''); setEditing(false); };

  if (editing) {
    return (
      <div style={{ padding: '8px 10px', borderRadius: 'var(--r-md)', background: 'var(--gray-6)', border: '1.5px solid var(--blue)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          style={{ fontSize: '12.5px', fontWeight: 600, background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray-1)', padding: '0', width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} aria-label="Due date"
            style={{ fontSize: '11px', fontWeight: 600, color: editDue ? 'var(--gray-1)' : 'var(--gray-4)', background: 'var(--card-2)', border: '1px solid var(--sep)', borderRadius: 'var(--r-sm)', padding: '5px 8px', outline: 'none', colorScheme: 'dark' }} />
          {editDue && (
            <button type="button" onClick={() => setEditDue('')} aria-label="Clear due date"
              style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--gray-4)', cursor: 'pointer' }}>clear</button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={() => setEditPriority('high')} style={{ fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: editPriority === 'high' ? 'var(--red)' : 'var(--gray-5)', color: editPriority === 'high' ? '#fff' : 'var(--gray-3)' }}>High</button>
            <button type="button" onClick={() => setEditPriority('low')}  style={{ fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: editPriority === 'low'  ? 'var(--blue)' : 'var(--gray-5)', color: editPriority === 'low'  ? '#fff' : 'var(--gray-3)' }}>Low</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={save}   style={{ fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--blue)', color: '#fff' }}>Save</button>
            <button type="button" onClick={cancel} style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px',  borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--gray-5)', color: 'var(--gray-3)' }}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 44px 44px 36px', alignItems: 'center', minHeight: '44px', borderRadius: 'var(--r-md)', background: todo.completed ? 'transparent' : 'var(--gray-6)', border: `1px solid ${todo.completed ? 'transparent' : 'var(--sep)'}`, opacity: todo.completed ? 0.58 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IonCheckbox checked={todo.completed} onIonChange={() => onToggle(todo.id, !todo.completed)} aria-label={`Toggle ${todo.text}`}
          style={{ '--size': '22px', '--checkbox-background': 'transparent', '--checkbox-background-checked': 'var(--blue)', '--border-color': todo.priority === 'high' ? 'var(--red)' : 'var(--gray-4)', '--border-color-checked': 'var(--blue)', '--checkmark-color': 'var(--bg)', '--border-radius': '7px' }} />
      </div>
      <div onClick={() => !todo.completed && setEditing(true)}
        style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px', cursor: todo.completed ? 'default' : 'text', WebkitTapHighlightColor: 'transparent' }}>
        <span style={{ fontSize: '12.5px', fontWeight: todo.completed ? 500 : 700, color: todo.completed ? 'var(--gray-4)' : 'var(--gray-1)', textDecoration: todo.completed ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {todo.text}
        </span>
        {todo.due_date && <DueBadge date={todo.due_date} completed={todo.completed} />}
      </div>
      <CopyButton text={todo.text} />
      <button type="button" onClick={() => onDelete(todo.id)} aria-label={`Delete ${todo.text}`}
        style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>×</button>
      <div style={{ color: tone, opacity: 0.78, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <IonReorder />
      </div>
    </div>
  );
}

function DoneRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: TodoCardProps['onToggle']; onDelete: TodoCardProps['onDelete'] }) {
  const dot = todo.priority === 'high' ? 'var(--red)' : 'var(--blue)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '44px', padding: '0 0 0 8px', borderRadius: 'var(--r-md)', opacity: 0.6 }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--gray-3)', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{todo.text}</span>
      <CopyButton text={todo.text} />
      <button type="button" onClick={() => onToggle(todo.id, false)} title="Restore"
        style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>↩</button>
      <button type="button" onClick={() => onDelete(todo.id)} title="Delete"
        style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>×</button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', minHeight: '44px', marginTop: '6px', border: '1px dashed var(--gray-5)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-3)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function AddRow({ value, due, onChange, onDueChange, onConfirm, onCancel }: { value: string; due: string; onChange: (v: string) => void; onDueChange: (v: string) => void; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0 0' }}>
      <input autoFocus value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }}
        placeholder="New task"
        style={{ minHeight: '44px', fontSize: '13px', color: 'var(--black)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '9px 10px', outline: 'none', minWidth: 0 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 44px', gap: '6px', alignItems: 'center' }}>
        <input type="date" value={due} onChange={e => onDueChange(e.target.value)} aria-label="Due date (optional)"
          style={{ minHeight: '44px', fontSize: '12px', fontWeight: 600, color: due ? 'var(--black)' : 'var(--gray-4)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '0 10px', outline: 'none', minWidth: 0, colorScheme: 'dark' }} />
        <button type="button" onClick={onConfirm}
          style={{ minHeight: '44px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--blue)', color: 'var(--bg)', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>Add</button>
        <button type="button" onClick={onCancel} aria-label="Cancel"
          style={{ minHeight: '44px', minWidth: '44px', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--gray-3)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>
    </div>
  );
}
