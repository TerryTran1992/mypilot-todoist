import { FormEvent, useMemo, useRef, useState } from 'react';
import { createTodo, useTodos } from '../store/todos';
import TodoRow from '../components/TodoRow';
import Icon from '../components/Icon';
import { byScore } from '../lib/sort';

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type Filter = 'all' | 'open' | 'done';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

export default function Inbox() {
  const { todos, loading, error, setError } = useTodos();
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [adding, setAdding] = useState(false);
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

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await createTodo({ title, priority: newPriority });
      setNewTitle('');
      setNewPriority('medium');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

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

      <form onSubmit={handleAdd} className="px-6 py-4 border-b border-zinc-800 space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task and press Enter…"
          disabled={adding}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <div className="flex gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setNewPriority(p)}
              className={`px-2 py-0.5 text-[10px] uppercase rounded-full cursor-pointer transition ${
                newPriority === p
                  ? p === 'urgent'
                    ? 'bg-red-900 text-red-200'
                    : p === 'high'
                    ? 'bg-orange-900 text-orange-200'
                    : p === 'medium'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-800 text-zinc-300'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </form>

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
            {todos.length === 0 ? 'No todos yet. Add one above.' : 'Nothing matches.'}
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
