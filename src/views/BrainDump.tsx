import { FormEvent, useEffect, useRef, useState } from 'react';
import { createTodo, deleteTodo, useTodos } from '../store/todos';
import Icon from '../components/Icon';
import { stripDiacritics } from '../lib/fuzzy';

interface MatchItem { id: string; title: string; is_completed: boolean }
type FuseResult = { item: MatchItem; score?: number };

function useDebouncedFuzzy(
  todos: MatchItem[],
  query: string,
  delay = 200,
) {
  const [results, setResults] = useState<FuseResult[]>([]);

  useEffect(() => {
    const q = stripDiacritics(query.trim()).toLowerCase();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      const matches = todos
        .map((t) => {
          const normalized = stripDiacritics(t.title).toLowerCase();
          if (!normalized.includes(q)) return null;
          const score = 1 - (q.length / normalized.length);
          return { item: t, score };
        })
        .filter(Boolean)
        .slice(0, 5) as FuseResult[];
      setResults(matches);
    }, delay);
    return () => clearTimeout(timer);
  }, [query, delay, todos]);

  return results;
}

export default function BrainDump({ onStartPlanning }: { onStartPlanning: () => void }) {
  const { todos } = useTodos();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);

  const matches = useDebouncedFuzzy(todos, title, 150);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const captured = todos.filter((t) => sessionIds.includes(t.id));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const created = await createTodo({ title: t });
      setSessionIds((ids) => [created.id, ...ids]);
      setTitle('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-white">
      <div className="w-full max-w-xl">
        <h1 className="font-heading text-5xl font-bold mb-2 text-center text-accent">Brain Dump</h1>
        <p className="text-zinc-400 text-center mb-10 font-medium">
          Get it out of your head. Type a thought, hit Enter, repeat.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="What's on your mind?"
            className="w-full px-6 py-4 text-lg bg-surface-raised border border-zinc-800/60 rounded-2xl focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 text-white placeholder-zinc-500 transition-all duration-200"
          />
        </form>

        {matches.length > 0 && (
          <div className="mt-2 bg-surface-raised border border-zinc-800/60 rounded-xl overflow-hidden">
            <p className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60 font-semibold">
              Similar existing tasks
            </p>
            <ul>
              {matches.map(({ item, score }) => (
                <li
                  key={item.id}
                  className="px-4 py-2 text-sm text-zinc-300 border-b border-zinc-800/50 last:border-b-0 flex items-center justify-between"
                >
                  <span className={item.is_completed ? 'line-through text-zinc-600' : ''}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 ml-2 shrink-0">
                    {Math.round((1 - (score ?? 0)) * 100)}% match
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {captured.length > 0 && (
          <div className="mt-10">
            <p className="text-sm text-zinc-400 mb-4 text-center">
              You've captured <span className="text-white">{captured.length}</span>{' '}
              {captured.length === 1 ? 'task' : 'tasks'} this session.
            </p>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {captured.map((t) => (
                <li
                  key={t.id}
                  className="px-4 py-2 bg-zinc-900/50 rounded-lg text-sm text-zinc-300 flex items-center justify-between group"
                >
                  <span>{t.title}</span>
                  <button
                    onClick={async () => {
                      await deleteTodo(t.id);
                      setSessionIds((ids) => ids.filter((id) => id !== t.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 cursor-pointer transition"
                    title="Remove task"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <button
                onClick={onStartPlanning}
                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-accent/20"
              >
                Start planning →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
