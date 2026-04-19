import { FormEvent, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'mypilot_token';
const REFRESH_KEY = 'mypilot_refresh';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITIES: { value: Priority; label: string; color: string; key: string }[] = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500', key: '4' },
  { value: 'high', label: 'High', color: 'bg-orange-500', key: '3' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500', key: '2' },
  { value: 'low', label: 'Low', color: 'bg-zinc-500', key: '1' },
];

export default function QuickAddPanel() {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);

    const onFocus = () => {
      setTitle('');
      setPriority('medium');
      setSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;

    setBusy(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const cookie = localStorage.getItem(REFRESH_KEY);

      const res = await window.api.request({
        method: 'POST',
        path: '/todos',
        body: { title: t, priority },
        token,
        cookie,
      });

      if (res.ok) {
        setSuccess(true);
        window.api.notifyTodoCreated();
        setTimeout(() => {
          setTitle('');
          setPriority('medium');
          setSuccess(false);
          window.api.hideQuickAdd();
        }, 400);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setTitle('');
      window.api.hideQuickAdd();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const priorityMap: Record<string, Priority> = { '1': 'low', '2': 'medium', '3': 'high', '4': 'urgent' };
      const p = priorityMap[e.key];
      if (p) {
        e.preventDefault();
        setPriority(p);
      }
    }
  }

  const modKey = window.api.platform === 'darwin' ? '⌃' : 'Ctrl+';

  return (
    <div className="h-screen w-screen flex items-start justify-center">
      <form
        onSubmit={handleSubmit}
        className={`w-full mx-3 mt-2 rounded-2xl border shadow-2xl backdrop-blur-xl transition-colors duration-200 ${
          success
            ? 'bg-accent/20 border-accent/40'
            : 'bg-zinc-900/95 border-zinc-700/60'
        }`}
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            success ? 'border-accent bg-accent' : 'border-zinc-600'
          }`}>
            {success && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Add a task..."
            disabled={busy || success}
            autoFocus
            className="flex-1 bg-transparent text-[15px] focus:outline-none text-white placeholder-zinc-500"
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                  priority === p.value
                    ? `${p.color} text-white`
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
                title={`Priority: ${p.label} (${modKey}${p.key})`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">
              <kbd className="px-1 py-0.5 bg-zinc-800/60 rounded text-zinc-500">Enter</kbd> save
              {' '}<kbd className="px-1 py-0.5 bg-zinc-800/60 rounded text-zinc-500">Esc</kbd> close
            </span>
            <button
              type="submit"
              disabled={!title.trim() || busy || success}
              className="px-3 py-1 rounded-lg bg-accent text-black text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition"
            >
              {busy ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
