import { useTodos } from '../store/todos';
import Icon from './Icon';

export type View = 'brain' | 'today' | 'weekly' | 'matrix' | 'delegation' | 'inbox' | 'completed';

const items: {
  id: View;
  label: string;
  icon: 'brain' | 'calendar' | 'zap' | 'grid' | 'users' | 'inbox' | 'check';
  shortcut: string;
}[] = [
  { id: 'brain', label: 'Brain Dump', icon: 'brain', shortcut: '⌘1' },
  { id: 'today', label: 'Today', icon: 'calendar', shortcut: '⌘2' },
  { id: 'weekly', label: 'Weekly Planner', icon: 'zap', shortcut: '⌘3' },
  { id: 'matrix', label: 'Matrix', icon: 'grid', shortcut: '⌘4' },
  { id: 'delegation', label: 'Delegation', icon: 'users', shortcut: '⌘5' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', shortcut: '⌘6' },
  { id: 'completed', label: 'Completed', icon: 'check', shortcut: '⌘7' },
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

  const weeklyCount = todos.filter((t) => !t.is_completed && !t.estimated_minutes).length;

  const delegationCount = todos.filter(
    (t) => t.delegated_to && t.delegation_status && t.delegation_status !== 'done',
  ).length;

  const counts: Record<View, number> = {
    brain: 0,
    today: todayCount,
    weekly: weeklyCount,
    matrix: 0,
    delegation: delegationCount,
    inbox: inboxCount,
    completed: doneCount,
  };

  return (
    <aside
      className={`shrink-0 h-full bg-zinc-950 border-r border-zinc-900 flex flex-col transition-all ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}
    >
      <nav className="flex-1 px-2 pt-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onView(item.id)}
            className={`no-drag w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition ${
              view === item.id
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
            }`}
          >
            <Icon name={item.icon} size={16} />
            <span className="flex-1 text-left">{item.label}</span>
            {counts[item.id] > 0 && (
              <span className="text-[10px] text-zinc-500">{counts[item.id]}</span>
            )}
            <span className="text-[10px] text-zinc-600">{item.shortcut}</span>
          </button>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-zinc-900 text-xs text-zinc-500">
        <p className="truncate mb-1">{userEmail}</p>
        <button
          onClick={onLogout}
          className="no-drag text-zinc-500 hover:text-white cursor-pointer transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
