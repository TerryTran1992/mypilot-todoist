import { useMemo, useRef, useState } from 'react';
import { useTodos } from '../store/todos';
import TodoRow from '../components/TodoRow';
import Icon from '../components/Icon';
import { byScore } from '../lib/sort';
import { useFuzzyFilter } from '../lib/fuzzy';

type Filter = 'all' | 'open' | 'done';

export default function Inbox() {
  const { todos, loading, error, setError } = useTodos();
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const statusFiltered = useMemo(() => {
    return todos.filter((t) => {
      if (filter === 'open' && t.is_completed) return false;
      if (filter === 'done' && !t.is_completed) return false;
      return true;
    });
  }, [todos, filter]);

  const fuzzyFiltered = useFuzzyFilter(statusFiltered, search, ['title', 'content']);

  const visible = useMemo(() => {
    return [...fuzzyFiltered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
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
    </div>
  );
}
