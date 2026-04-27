import { useCallback, useMemo, useRef, useState } from 'react';
import { useTodos } from '../store/todos';
import TodoRow from '../components/TodoRow';
import Icon from '../components/Icon';
import CategoryFilter, { CategoryFilterValue } from '../components/CategoryFilter';
import { byScore } from '../lib/sort';
import { useFuzzyFilter } from '../lib/fuzzy';
import api from '../lib/api';

type Filter = 'all' | 'open' | 'done';
type SyncResult = { provider: string; created: number; skipped: number };

const CALENDARS = [
  { key: 'outlook' as const, name: 'Outlook Calendar', accent: 'blue' },
  { key: 'google' as const, name: 'Google Calendar', accent: 'red' },
];

export default function Inbox() {
  const { todos, loading, error, setError, refresh } = useTodos();
  const [filter, setFilter] = useState<Filter>('open');
  const [category, setCategory] = useState<CategoryFilterValue>(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const [showSync, setShowSync] = useState(false);
  const [syncing, setSyncing] = useState<'outlook' | 'google' | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({});

  const handleSync = useCallback(async (provider: 'outlook' | 'google') => {
    if (syncing) return;
    setSyncing(provider);
    try {
      const result = await api.post<SyncResult>('/todos/sync-calendar', { provider });
      setSyncResults((prev) => ({ ...prev, [provider]: result }));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setShowSync(false);
    } finally {
      setSyncing(null);
    }
  }, [syncing, refresh, setError]);

  const statusFiltered = useMemo(() => {
    return todos.filter((t) => {
      if (filter === 'open' && t.is_completed) return false;
      if (filter === 'done' && !t.is_completed) return false;
      if (category === 'uncategorized' && t.category) return false;
      if (category && category !== 'uncategorized' && t.category !== category) return false;
      return true;
    });
  }, [todos, filter, category]);

  const fuzzyFiltered = useFuzzyFilter(statusFiltered, search, ['title', 'content']);

  const visible = useMemo(() => {
    return [...fuzzyFiltered].sort((a, b) => {
      return byScore(a, b);
    });
  }, [fuzzyFiltered]);

  return (
    <div className="h-full flex flex-col">
      <header className="drag flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
        <div>
          <h1 className="font-heading text-3xl font-bold text-accent">Inbox</h1>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {todos.filter((t) => !t.is_completed).length} open · {todos.length} total
          </p>
        </div>
        <button
          onClick={() => { setSyncResults({}); setShowSync(true); }}
          className="no-drag flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-raised border border-zinc-800/60 text-zinc-400 hover:text-white hover:border-accent/30 hover:bg-accent/5 transition-all duration-200 cursor-pointer"
        >
          <Icon name="refresh-cw" size={14} />
          Sync Data
        </button>
      </header>

      <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800/60">
        {(['open', 'all', 'done'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-semibold rounded-full cursor-pointer capitalize transition-all duration-200 ${
              filter === f
                ? 'bg-accent text-black shadow-sm'
                : 'bg-surface-raised text-zinc-400 hover:text-white border border-zinc-800/60'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="mx-2 w-px h-5 bg-zinc-800" />
        <CategoryFilter value={category} onChange={setCategory} />
        <div className="ml-auto relative">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchRef}
            data-search-input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-xs bg-surface-raised border border-zinc-800/60 rounded-full focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 w-48 transition-all duration-200"
          />
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-zinc-500 text-sm">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">
            {todos.length === 0 ? 'No todos yet.' : 'Nothing matches.'}
          </p>
        ) : (
          <ul>
            {visible.map((t) => (
              <TodoRow key={t.id} t={t} onError={setError} />
            ))}
          </ul>
        )}
      </main>

      {showSync && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowSync(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15">
                <Icon name="refresh-cw" size={16} className="text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">Sync Calendar</h3>
                <p className="text-xs text-zinc-500">Import meetings as tasks</p>
              </div>
              <button
                onClick={() => setShowSync(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {CALENDARS.map((cal) => {
                const isSyncing = syncing === cal.key;
                const result = syncResults[cal.key];
                const accentClasses = cal.accent === 'blue'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-red-500/15 text-red-400';

                return (
                  <div
                    key={cal.key}
                    className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses}`}>
                      <Icon name="calendar" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{cal.name}</p>
                      {result && (
                        <p className="text-xs text-accent mt-0.5">
                          {result.created > 0
                            ? `Synced ${result.created} meeting(s)`
                            : 'No new meetings'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSync(cal.key)}
                      disabled={syncing !== null}
                      className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                        result
                          ? 'bg-accent/15 border border-accent/30 text-accent'
                          : 'bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSyncing ? (
                        <>
                          <Icon name="loader" size={14} className="animate-spin" />
                          Syncing…
                        </>
                      ) : result ? (
                        <>
                          <Icon name="check" size={14} />
                          Done
                        </>
                      ) : (
                        <>
                          <Icon name="refresh-cw" size={14} />
                          Sync
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
