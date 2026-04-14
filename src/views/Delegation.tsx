import { useMemo } from 'react';
import { useTodos, updateTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { DelegationStatus, Todo } from '../types';
import Icon from '../components/Icon';

type Column = {
  id: DelegationStatus;
  label: string;
  next?: DelegationStatus;
  bar: string;
  badge: string;
};

const COLUMNS: Column[] = [
  { id: 'delegated', label: 'Delegated', next: 'in_progress', bar: 'bg-zinc-600', badge: 'bg-zinc-800 text-zinc-300' },
  { id: 'in_progress', label: 'In Progress', next: 'review', bar: 'bg-sky-500', badge: 'bg-sky-950 text-sky-300' },
  { id: 'review', label: 'In Review', next: 'done', bar: 'bg-amber-500', badge: 'bg-amber-950 text-amber-300' },
  { id: 'done', label: 'Done', bar: 'bg-accent', badge: 'bg-accent/20 text-accent' },
];

function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function isOverdue(t: Todo) {
  if (t.delegation_status === 'done') return false;
  const d = daysSince(t.delegated_at);
  if (d === null) return false;
  return d >= (t.follow_up_days ?? 3);
}

export default function Delegation() {
  const { todos, loading, error, setError } = useTodos();

  const delegated = useMemo(
    () => todos.filter((t) => t.delegated_to && t.delegation_status),
    [todos],
  );

  const grouped = useMemo(() => {
    const g: Record<DelegationStatus, Todo[]> = {
      delegated: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of delegated) {
      const status = t.delegation_status as DelegationStatus;
      if (g[status]) g[status].push(t);
    }
    return g;
  }, [delegated]);

  const followUps = delegated.filter(isOverdue).length;

  async function advance(t: Todo, next: DelegationStatus) {
    try {
      const patch: Partial<Todo> = { delegation_status: next };
      if (next === 'done') {
        patch.is_completed = true;
        patch.completed_at = new Date().toISOString();
      }
      await updateTodo(t.id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Delegation</h1>
          <p className="text-xs text-zinc-500">
            {delegated.length} task{delegated.length === 1 ? '' : 's'} delegated
            {followUps > 0 && (
              <>
                {' '}· <span className="text-amber-400">{followUps} need follow-up</span>
              </>
            )}
          </p>
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

      {loading && delegated.length === 0 ? (
        <p className="p-6 text-zinc-500 text-sm">Loading…</p>
      ) : delegated.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div className="max-w-sm">
            <Icon name="users" size={28} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-300 mb-1">No delegated tasks yet.</p>
            <p className="text-xs text-zinc-500">
              Open any task and add a name in the Delegated To field to start tracking it here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-max h-full grid grid-cols-4 gap-3 p-6">
            {COLUMNS.map((col) => {
              const items = grouped[col.id];
              return (
                <section key={col.id} className="w-72 flex flex-col bg-zinc-950 border border-zinc-900 rounded-xl min-h-0">
                  <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.bar}`} />
                      <h3 className="text-sm font-semibold">{col.label}</h3>
                    </div>
                    <span className="text-xs text-zinc-500">{items.length}</span>
                  </header>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-zinc-600 italic px-1 py-2">No tasks here.</p>
                    ) : (
                      items.map((t) => {
                        const since = daysSince(t.delegated_at);
                        const overdue = isOverdue(t);
                        return (
                          <article
                            key={t.id}
                            className={`bg-zinc-900 border rounded-lg px-3 py-2.5 text-sm transition hover:border-zinc-700 ${
                              overdue ? 'border-amber-900/60' : 'border-zinc-800'
                            }`}
                          >
                            <button
                              onClick={() => openTask(t.id)}
                              className={`block w-full text-left cursor-pointer hover:text-accent transition ${
                                t.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                              }`}
                            >
                              {t.title}
                            </button>

                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                              {t.delegated_to && (
                                <span className="inline-flex items-center gap-1">
                                  <Icon name="users" size={10} />
                                  {t.delegated_to}
                                </span>
                              )}
                              {since !== null && (
                                <>
                                  <span>·</span>
                                  <span className={overdue ? 'text-amber-400' : ''}>
                                    {since === 0 ? 'today' : `${since}d ago`}
                                    {overdue && ' · follow up'}
                                  </span>
                                </>
                              )}
                            </div>

                            {col.next && (
                              <button
                                onClick={() => advance(t, col.next!)}
                                className="mt-2 w-full text-[11px] py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer transition flex items-center justify-center gap-1"
                              >
                                Move to {COLUMNS.find((c) => c.id === col.next)?.label}
                                <Icon name="arrow-right" size={10} />
                              </button>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
