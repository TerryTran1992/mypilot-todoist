import { FormEvent, useEffect, useRef, useState } from 'react';
import { createTodo } from '../store/todos';
import Icon from './Icon';

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('quick-capture:open', onOpen);
    return () => window.removeEventListener('quick-capture:open', onOpen);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await createTodo({ title: t });
      setTitle('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-accent hover:bg-accent/90 rounded-full shadow-lg shadow-accent/20 flex items-center justify-center text-black cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-accent/30 z-10"
        aria-label="Quick capture"
      >
        <Icon name="plus" size={22} />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-28 z-20 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-4 bg-surface-raised border border-zinc-800/60 rounded-2xl p-5 shadow-2xl"
          >
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What needs doing?"
              disabled={busy}
              className="w-full bg-transparent text-lg font-medium focus:outline-none text-white placeholder-zinc-500"
            />
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/60">
              <p className="text-[11px] text-zinc-500">
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Enter</kbd> to save ·{' '}
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">Esc</kbd> to cancel
              </p>
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="px-3 py-1 text-xs bg-accent hover:bg-accent/90 disabled:opacity-40 text-black font-semibold rounded-lg cursor-pointer transition-all duration-200"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
