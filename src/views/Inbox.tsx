import { useMemo, useRef, useState } from 'react';
import { useTodos } from '../store/todos';
import TodoRow from '../components/TodoRow';
import Icon from '../components/Icon';
import { byScore } from '../lib/sort';

type Filter = 'all' | 'open' | 'done';

export default function Inbox() {
  const { todos, loading, error, setError } = useTodos();
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos
      .filter((t) => {
        if (filter === 'open' && t.is_completed) return false;
        if (filter === 'done' && !t.is_completed) return false;
        if (q && !t.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return byScore(a, b);
      });
  }, [todos, filter, search]);

  return (
    <div className="h-full flex flex-col">
      <header className="drag flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-xs text-zinc-500">
            {todos.filter((t) => !t.is_completed).length} open · {todos.length} total
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800">
        {(['open', 'all', 'done'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full cursor-pointer capitalize transition ${
              filter === f
                ? 'bg-accent text-black'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto relative">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchRef}
            data-search-input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-full focus:border-accent focus:outline-none w-48"
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
    </div>
  );
}
