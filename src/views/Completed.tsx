import { useMemo, useRef, useState } from 'react';
import { useTodos } from '../store/todos';
import TodoRow from '../components/TodoRow';
import Icon from '../components/Icon';
import { byScore } from '../lib/sort';

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function formatDay(key: string) {
  const d = new Date(key + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Completed() {
  const { todos, loading, error, setError } = useTodos();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const done = useMemo(
    () =>
      todos
        .filter((t) => t.is_completed)
        .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at)),
    [todos],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return done;
    return done.filter(
      (t) => t.title.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q),
    );
  }, [done, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const t of filtered) {
      const key = dayKey(t.completed_at ?? t.created_at);
      (groups[key] ??= []).push(t);
    }
    for (const k of Object.keys(groups)) groups[k].sort(byScore);
    return Object.entries(groups);
  }, [filtered]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = done.filter((t) => dayKey(t.completed_at ?? t.created_at) === todayKey).length;

  return (
    <div className="h-full flex flex-col">
      <header className="drag flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Completed</h1>
          <p className="text-xs text-zinc-500">
            {todayCount} done today · {done.length} all time
          </p>
        </div>
        <div className="no-drag relative">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchRef}
            data-search-input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-7 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-full focus:border-accent focus:outline-none w-48"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer p-0.5"
              aria-label="Clear search"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 cursor-pointer">
            ×
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-zinc-500 text-sm">Loading…</p>
        ) : done.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <p className="text-sm">Nothing completed yet.</p>
            <p className="text-xs mt-2">Finish a task to see it here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <p className="text-sm">No matches for &ldquo;{search}&rdquo;</p>
            <p className="text-xs mt-2">Try a different search term.</p>
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <section key={day}>
              <div className="sticky top-0 bg-black/80 backdrop-blur px-6 py-2 border-b border-zinc-900 flex items-center justify-between">
                <h2 className="text-xs uppercase tracking-wide text-zinc-500">{formatDay(day)}</h2>
                <span className="text-xs text-zinc-600">{items.length}</span>
              </div>
              <ul>
                {items.map((t) => (
                  <TodoRow key={t.id} t={t} onError={setError} />
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
