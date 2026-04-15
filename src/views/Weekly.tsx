import { useMemo, useState } from 'react';
import { useTodos, updateTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { EnergyType, Todo } from '../types';
import Icon from '../components/Icon';
import { byScore } from '../lib/sort';

type SizeKey = 'big' | 'medium' | 'small';

const SIZES: {
  id: SizeKey;
  label: string;
  short: string;
  minutes: number;
  energy: EnergyType;
  blurb: string;
  badge: string;
}[] = [
  {
    id: 'big',
    label: 'Big',
    short: 'B',
    minutes: 180,
    energy: 'deep_focus',
    blurb: '2–4 hours',
    badge: 'bg-purple-900 text-purple-200',
  },
  {
    id: 'medium',
    label: 'Med',
    short: 'M',
    minutes: 45,
    energy: 'deep_focus',
    blurb: '30–60 min',
    badge: 'bg-blue-900 text-blue-200',
  },
  {
    id: 'small',
    label: 'Quick',
    short: 'Q',
    minutes: 10,
    energy: 'quick_win',
    blurb: '5–15 min',
    badge: 'bg-yellow-900 text-yellow-200',
  },
];

function sizeFor(minutes: number | null | undefined): SizeKey | null {
  if (!minutes) return null;
  if (minutes >= 90) return 'big';
  if (minutes >= 30) return 'medium';
  return 'small';
}

export default function Weekly() {
  const { todos, loading, error, setError } = useTodos();
  const [filter, setFilter] = useState<'unlabeled' | 'all'>('unlabeled');
  const [search, setSearch] = useState('');

  const open = useMemo(
    () => todos.filter((t) => !t.is_completed).sort(byScore),
    [todos],
  );
  const unlabeled = useMemo(() => open.filter((t) => !t.estimated_minutes), [open]);
  const labeled = useMemo(() => open.filter((t) => t.estimated_minutes), [open]);

  const visible = useMemo(() => {
    const base = filter === 'unlabeled' ? unlabeled : open;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((t) => t.title.toLowerCase().includes(q));
  }, [filter, unlabeled, open, search]);

  async function setSize(t: Todo, size: SizeKey) {
    const meta = SIZES.find((s) => s.id === size)!;
    try {
      await updateTodo(t.id, {
        estimated_minutes: meta.minutes,
        energy_type: meta.energy,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to label');
    }
  }

  async function setCustomEstimate(t: Todo, minutes: number | null) {
    try {
      const update: Partial<Todo> = { estimated_minutes: minutes };
      const size = sizeFor(minutes);
      if (size) {
        const meta = SIZES.find((s) => s.id === size)!;
        update.energy_type = meta.energy;
      }
      await updateTodo(t.id, update);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  const counts = {
    unlabeled: unlabeled.length,
    big: labeled.filter((t) => sizeFor(t.estimated_minutes) === 'big').length,
    medium: labeled.filter((t) => sizeFor(t.estimated_minutes) === 'medium').length,
    small: labeled.filter((t) => sizeFor(t.estimated_minutes) === 'small').length,
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold">Weekly Planner</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Label every brain-dumped task as Big, Med, or Quick so the Daily Planner can use them.
        </p>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {(['unlabeled', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full cursor-pointer capitalize transition ${
                filter === f
                  ? 'bg-accent text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'unlabeled' ? `Unlabeled · ${counts.unlabeled}` : `All · ${open.length}`}
            </button>
          ))}
          <div className="relative ml-2">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              data-search-input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8 pr-3 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-full focus:border-accent focus:outline-none w-56"
            />
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
            <span>Big · {counts.big}</span>
            <span>Med · {counts.medium}</span>
            <span>Quick · {counts.small}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 bg-red-950/40 border-b border-red-900 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6">
        {loading && open.length === 0 ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-12">
            <Icon name={search ? 'search' : 'check'} size={28} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-300 mb-1">
              {search
                ? 'Nothing matches.'
                : filter === 'unlabeled'
                ? 'Everything is labeled.'
                : 'No open tasks.'}
            </p>
            <p className="text-xs text-zinc-500">
              {search
                ? 'Try a different search term.'
                : filter === 'unlabeled'
                ? 'Head to the Today view to schedule your day.'
                : 'Capture some in Brain Dump first.'}
            </p>
          </div>
        ) : (
          <ul className="max-w-3xl mx-auto space-y-2">
            {visible.map((t) => (
              <Row key={t.id} t={t} onSize={setSize} onCustom={setCustomEstimate} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Row({
  t,
  onSize,
  onCustom,
}: {
  t: Todo;
  onSize: (t: Todo, size: SizeKey) => void;
  onCustom: (t: Todo, minutes: number | null) => void;
}) {
  const currentSize = sizeFor(t.estimated_minutes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(t.estimated_minutes ?? ''));

  return (
    <li className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
      <button
        onClick={() => openTask(t.id)}
        className="flex-1 min-w-0 text-left text-sm text-zinc-100 hover:text-accent cursor-pointer transition truncate"
      >
        {t.title}
      </button>

      {currentSize && !editing && (
        <span
          className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
            SIZES.find((s) => s.id === currentSize)!.badge
          }`}
        >
          {SIZES.find((s) => s.id === currentSize)!.label} · {t.estimated_minutes}m
        </span>
      )}

      <div className="flex items-center gap-1">
        {SIZES.map((s) => (
          <button
            key={s.id}
            onClick={() => onSize(t, s.id)}
            title={`${s.label} — ${s.blurb}`}
            className={`px-2 py-1 text-[11px] rounded cursor-pointer transition ${
              currentSize === s.id
                ? 'bg-accent text-black'
                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            {s.short}
          </button>
        ))}

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = draft.trim() === '' ? null : Math.max(1, Number(draft));
              onCustom(t, Number.isFinite(n as number) ? (n as number) : null);
              setEditing(false);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="number"
              min={1}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setEditing(false)}
              className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
            <span className="text-[11px] text-zinc-500">min</span>
          </form>
        ) : (
          <button
            onClick={() => {
              setDraft(String(t.estimated_minutes ?? ''));
              setEditing(true);
            }}
            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-white cursor-pointer rounded transition"
            title="Custom minutes"
          >
            ···
          </button>
        )}
      </div>
    </li>
  );
}
