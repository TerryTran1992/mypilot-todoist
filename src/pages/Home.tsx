import { useEffect, useState } from 'react';
import { clearAuth, getUser } from '../lib/auth';
import Sidebar, { View } from '../components/Sidebar';
import QuickCapture from '../components/QuickCapture';
import BrainDump from '../views/BrainDump';
import Today from '../views/Today';
import Upcoming from '../views/Upcoming';
import WeeklyReview from '../views/WeeklyReview';
import Matrix from '../views/Matrix';
import Delegation from '../views/Delegation';
import Inbox from '../views/Inbox';
import Completed from '../views/Completed';
import Icon from '../components/Icon';
import TaskDetail from '../components/TaskDetail';
import { useOnline, usePendingCount } from '../lib/useNetwork';
import { closeTask } from '../store/selection';

const LAST_VIEW_KEY = 'mypilot_last_view';
const SIDEBAR_KEY = 'mypilot_sidebar';

export default function Home({ onLogout }: { onLogout: () => void }) {
  const user = getUser();
  const [view, setView] = useState<View>(() => {
    const stored = localStorage.getItem(LAST_VIEW_KEY) as string | null;
    const valid: View[] = ['brain', 'today', 'upcoming', 'review', 'matrix', 'delegation', 'inbox', 'completed'];
    return (valid.includes(stored as View) ? (stored as View) : 'today') as View;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const online = useOnline();
  const pending = usePendingCount();

  useEffect(() => {
    localStorage.setItem(LAST_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeTask();
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key) {
        case '1':
          e.preventDefault();
          setView('brain');
          break;
        case '2':
          e.preventDefault();
          setView('today');
          break;
        case '3':
          e.preventDefault();
          setView('upcoming');
          break;
        case '4':
          e.preventDefault();
          setView('review');
          break;
        case '5':
          e.preventDefault();
          setView('matrix');
          break;
        case '6':
          e.preventDefault();
          setView('delegation');
          break;
        case '7':
          e.preventDefault();
          setView('inbox');
          break;
        case '8':
          e.preventDefault();
          setView('completed');
          break;
        case 'b':
          e.preventDefault();
          setCollapsed((c) => !c);
          break;
        case 'n':
          e.preventDefault();
          window.dispatchEvent(new Event('quick-capture:open'));
          break;
        case 'f': {
          e.preventDefault();
          const el = document.querySelector<HTMLInputElement>('[data-search-input]');
          el?.focus();
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleLogout() {
    clearAuth();
    onLogout();
  }

  return (
    <div className="h-full flex flex-col text-white bg-surface">
      <div className="drag shrink-0 h-11 flex items-center border-b border-zinc-900/60 pl-20 pr-4 bg-surface">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="no-drag text-zinc-500 hover:text-white cursor-pointer p-1.5 rounded-md hover:bg-surface-raised transition-all duration-200"
          aria-label="Toggle sidebar"
          title="Toggle sidebar (⌘B)"
        >
          <Icon name="sidebar" size={16} />
        </button>
        <div className="flex-1" />
        {!online && (
          <span className="no-drag text-xs px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-900/60 text-amber-300 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Offline
            {pending > 0 && <span className="text-amber-200/70">· {pending} pending</span>}
          </span>
        )}
        {online && pending > 0 && (
          <span className="no-drag text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Syncing · {pending}
          </span>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar
          view={view}
          onView={setView}
          onLogout={handleLogout}
          userEmail={user?.email}
          collapsed={collapsed}
        />

        <main className="flex-1 min-w-0 bg-surface">
          {view === 'brain' && <BrainDump onStartPlanning={() => setView('review')} />}
          {view === 'today' && <Today />}
          {view === 'upcoming' && <Upcoming />}
          {view === 'review' && <WeeklyReview />}
          {view === 'matrix' && <Matrix />}
          {view === 'delegation' && <Delegation />}
          {view === 'inbox' && <Inbox />}
          {view === 'completed' && <Completed />}
        </main>
      </div>

      <QuickCapture />
      <TaskDetail />
    </div>
  );
}
