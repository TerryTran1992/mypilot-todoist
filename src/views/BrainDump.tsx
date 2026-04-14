import { FormEvent, useEffect, useRef, useState } from 'react';
import { createTodo, useTodos } from '../store/todos';

export default function BrainDump({ onStartPlanning }: { onStartPlanning: () => void }) {
  const { todos } = useTodos();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);

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
        <h1 className="text-4xl font-semibold mb-2 text-center">Brain Dump</h1>
        <p className="text-zinc-400 text-center mb-10">
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
            className="w-full px-6 py-4 text-lg bg-zinc-900 border border-zinc-800 rounded-2xl focus:border-accent focus:outline-none text-white placeholder-zinc-500"
          />
        </form>

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
                  className="px-4 py-2 bg-zinc-900/50 rounded-lg text-sm text-zinc-300"
                >
                  {t.title}
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <button
                onClick={onStartPlanning}
                className="px-6 py-2 bg-accent hover:bg-accent/90 text-black font-medium rounded-lg cursor-pointer transition"
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
