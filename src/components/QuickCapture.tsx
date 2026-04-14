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
        className="fixed bottom-6 right-6 w-12 h-12 bg-accent hover:bg-accent/90 rounded-full shadow-lg flex items-center justify-center text-black cursor-pointer transition z-10"
        aria-label="Quick capture"
      >
        <Icon name="plus" size={22} />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-32 z-20"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl"
          >
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKey}
              placeholder="What needs doing?"
              disabled={busy}
              className="w-full bg-transparent text-lg focus:outline-none text-white placeholder-zinc-500"
            />
            <p className="text-[11px] text-zinc-500 mt-3">
              Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded">Enter</kbd> to save ·{' '}
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded">Esc</kbd> to cancel
            </p>
          </form>
        </div>
      )}
    </>
  );
}
