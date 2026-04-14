import { FormEvent, useEffect, useMemo, useState } from 'react';
import api, { ApiError } from '../lib/api';
import { clearAuth, getUser } from '../lib/auth';
import { Todo } from '../types';

type Filter = 'all' | 'open' | 'done';

export default function Home({ onLogout }: { onLogout: () => void }) {
  const user = getUser();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Todo[]>('/todos?limit=100');
      setTodos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const created = await api.post<Todo>('/todos', { title });
      setTodos((prev) => [created, ...prev]);
      setNewTitle('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function toggleComplete(t: Todo) {
    const nextCompleted = !t.is_completed;
    setTodos((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, is_completed: nextCompleted } : x)),
    );
    try {
      await api.put<Todo>(`/todos/${t.id}`, {
        is_completed: nextCompleted,
        status: nextCompleted ? 'done' : 'todo',
      });
    } catch (err) {
      setTodos((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, is_completed: t.is_completed } : x)),
      );
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    }
  }

  async function deleteTodo(t: Todo) {
    const prev = todos;
    setTodos((p) => p.filter((x) => x.id !== t.id));
    try {
      await api.delete(`/todos/${t.id}`);
    } catch (err) {
      setTodos(prev);
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  }

  function handleLogout() {
    clearAuth();
    onLogout();
  }

  const remaining = todos.filter((t) => !t.is_completed).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos.filter((t) => {
      if (filter === 'open' && t.is_completed) return false;
      if (filter === 'done' && !t.is_completed) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [todos, filter, search]);

  return (
    <div className="h-full flex flex-col text-white">
      <header className="drag flex items-center justify-between pl-24 pr-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Todos</h1>
          <p className="text-xs text-zinc-500">{remaining} open · {todos.length} total</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-zinc-400 hover:text-white cursor-pointer transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <form onSubmit={handleAdd} className="px-6 py-4 border-b border-zinc-800">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task and press Enter…"
          disabled={adding}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:border-accent focus:outline-none disabled:opacity-50"
        />
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto px-3 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-full focus:border-accent focus:outline-none w-48"
        />
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 cursor-pointer">×</button>
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
              <li
                key={t.id}
                className="flex items-center gap-3 px-6 py-3 border-b border-zinc-900 hover:bg-zinc-900/50 transition group"
              >
                <button
                  onClick={() => toggleComplete(t)}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition ${
                    t.is_completed
                      ? 'bg-accent border-accent'
                      : 'border-zinc-600 hover:border-accent'
                  }`}
                  aria-label={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {t.is_completed && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                <span
                  className={`flex-1 text-sm ${
                    t.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                  }`}
                >
                  {t.title}
                </span>

                {t.priority !== 'medium' && (
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                      t.priority === 'urgent'
                        ? 'bg-red-950 text-red-300'
                        : t.priority === 'high'
                        ? 'bg-orange-950 text-orange-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t.priority}
                  </span>
                )}

                <button
                  onClick={() => deleteTodo(t)}
                  className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition"
                  aria-label="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
