import { useTodos } from '../store/todos';
import Icon from './Icon';

export type View = 'brain' | 'today' | 'upcoming' | 'review' | 'matrix' | 'delegation' | 'inbox' | 'completed';

const items: {
  id: View;
  label: string;
  icon: 'brain' | 'calendar' | 'calendar-range' | 'clipboard-check' | 'grid' | 'users' | 'inbox' | 'check';
  shortcut: string;
}[] = [
  { id: 'brain', label: 'Brain Dump', icon: 'brain', shortcut: '⌘1' },
  { id: 'today', label: 'Today', icon: 'calendar', shortcut: '⌘2' },
  { id: 'upcoming', label: 'Upcoming', icon: 'calendar-range', shortcut: '⌘3' },
  { id: 'review', label: 'Weekly Review', icon: 'clipboard-check', shortcut: '⌘4' },
  { id: 'matrix', label: 'Matrix', icon: 'grid', shortcut: '⌘5' },
  { id: 'delegation', label: 'Delegation', icon: 'users', shortcut: '⌘6' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', shortcut: '⌘7' },
  { id: 'completed', label: 'Completed', icon: 'check', shortcut: '⌘8' },
];

export default function Sidebar({
  view,
  onView,
  onLogout,
  userEmail,
  collapsed,
}: {
  view: View;
  onView: (v: View) => void;
  onLogout: () => void;
  userEmail?: string;
  collapsed: boolean;
}) {
  const { todos } = useTodos();
  const inboxCount = todos.filter((t) => !t.is_completed).length;
  const doneCount = todos.filter((t) => t.is_completed).length;

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = todos.filter(
    (t) => !t.is_completed && t.time_block_date?.slice(0, 10) === today,
  ).length;

  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcomingCount = todos.filter((t) => {
    if (t.is_completed) return false;
    const d = t.deadline?.slice(0, 10) || t.time_block_date?.slice(0, 10);
    return d ? d >= today && d <= next7 : false;
  }).length;

  const delegationCount = todos.filter(
    (t) => t.delegated_to && t.delegation_status && t.delegation_status !== 'done',
  ).length;

  const counts: Record<View, number> = {
    brain: 0,
    today: todayCount,
    upcoming: upcomingCount,
    review: 0,
    matrix: 0,
    delegation: delegationCount,
    inbox: inboxCount,
    completed: doneCount,
  };

  return (
    <aside
      className={`shrink-0 h-full bg-surface border-r border-zinc-900/80 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}
    >
      <nav className="flex-1 px-2 pt-4 space-y-0.5">
        {items.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onView(item.id)}
              className={`no-drag w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 relative ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-raised'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
              )}
              <Icon name={item.icon} size={16} />
              <span className="flex-1 text-left font-medium">{item.label}</span>
              {counts[item.id] > 0 && (
                <span className={`text-[10px] min-w-[18px] text-center px-1 py-0.5 rounded-full ${
                  isActive ? 'bg-accent/20 text-accent' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {counts[item.id]}
                </span>
              )}
              <span className="text-[10px] text-zinc-600 tabular-nums">{item.shortcut}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-zinc-900/80">
        <p className="truncate text-xs text-zinc-500 mb-1.5 font-medium">{userEmail}</p>
        <button
          onClick={onLogout}
          className="no-drag text-xs text-zinc-500 hover:text-red-400 cursor-pointer transition-colors duration-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
