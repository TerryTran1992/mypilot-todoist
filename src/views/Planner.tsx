import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useTodos, toggleComplete } from '../store/todos';
import { openTask } from '../store/selection';
import { Todo } from '../types';
import { DailyPlan, getPlan, setPlan, todayKey } from '../lib/local';
import Icon from '../components/Icon';

type Slot = 'big' | 'medium' | 'small';
const POOL_ID = 'planner-pool';

const LIMITS: Record<Slot, number> = { big: 1, medium: 3, small: 5 };

function Card({ t, onToggle }: { t: Todo; onToggle: (t: Todo) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <button
        onClick={() => onToggle(t)}
        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition ${
          t.is_completed ? 'bg-accent border-accent' : 'border-zinc-600 hover:border-accent'
        }`}
      >
        {t.is_completed && <Icon name="check" size={10} className="text-black" />}
      </button>
      <span
        {...listeners}
        {...attributes}
        onClick={() => openTask(t.id)}
        className={`flex-1 truncate cursor-pointer select-none hover:text-accent transition ${
          t.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
        }`}
      >
        {t.title}
      </span>
    </div>
  );
}

function Drop({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'outline outline-2 outline-accent/60' : ''} transition`}
    >
      {children}
    </div>
  );
}

function formatDate(key: string) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function Planner() {
  const { todos, loading, error, setError } = useTodos();
  const [date] = useState(todayKey());
  const [plan, setLocalPlan] = useState<DailyPlan>(() => getPlan(date));
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setPlan(date, plan);
  }, [date, plan]);

  useEffect(() => {
    const ids = new Set(todos.map((t) => t.id));
    setLocalPlan((p) => {
      const next: DailyPlan = {
        bigTask: p.bigTask && ids.has(p.bigTask) ? p.bigTask : undefined,
        mediumTasks: p.mediumTasks.filter((id) => ids.has(id)),
        smallTasks: p.smallTasks.filter((id) => ids.has(id)),
        reflection: p.reflection,
      };
      return next;
    });
  }, [todos]);

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);

  const assignedIds = useMemo(() => {
    const s = new Set<string>();
    if (plan.bigTask) s.add(plan.bigTask);
    plan.mediumTasks.forEach((id) => s.add(id));
    plan.smallTasks.forEach((id) => s.add(id));
    return s;
  }, [plan]);

  const pool = useMemo(
    () => todos.filter((t) => !t.is_completed && !assignedIds.has(t.id)),
    [todos, assignedIds],
  );

  const onToggle = useCallback(
    async (t: Todo) => {
      try {
        await toggleComplete(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
      }
    },
    [setError],
  );

  function removeFromPlan(id: string): DailyPlan {
    return {
      bigTask: plan.bigTask === id ? undefined : plan.bigTask,
      mediumTasks: plan.mediumTasks.filter((x) => x !== id),
      smallTasks: plan.smallTasks.filter((x) => x !== id),
      reflection: plan.reflection,
    };
  }

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    if (!e.over) return;
    const todoId = String(e.active.id);
    const target = String(e.over.id) as Slot | typeof POOL_ID;

    const cleaned = removeFromPlan(todoId);

    if (target === POOL_ID) {
      setLocalPlan(cleaned);
      return;
    }
    if (target === 'big') {
      setLocalPlan({ ...cleaned, bigTask: todoId });
      return;
    }
    if (target === 'medium') {
      if (cleaned.mediumTasks.length >= LIMITS.medium) return;
      setLocalPlan({ ...cleaned, mediumTasks: [...cleaned.mediumTasks, todoId] });
      return;
    }
    if (target === 'small') {
      if (cleaned.smallTasks.length >= LIMITS.small) return;
      setLocalPlan({ ...cleaned, smallTasks: [...cleaned.smallTasks, todoId] });
    }
  }

  const dragging = dragId ? byId.get(dragId) : null;

  const sections: { id: Slot; title: string; subtitle: string; ids: string[] }[] = [
    { id: 'big', title: 'The One Big Thing', subtitle: 'Your highest-leverage task today', ids: plan.bigTask ? [plan.bigTask] : [] },
    { id: 'medium', title: '3 Medium Wins', subtitle: 'Meaningful progress', ids: plan.mediumTasks },
    { id: 'small', title: '5 Quick Hits', subtitle: 'Fast checkboxes', ids: plan.smallTasks },
  ];

  function progress(ids: string[]) {
    const items = ids.map((id) => byId.get(id)).filter((t): t is Todo => !!t);
    const done = items.filter((t) => t.is_completed).length;
    return { done, total: items.length };
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Daily Planner</h1>
          <p className="text-xs text-zinc-500">{formatDate(date)} · 1 Big · 3 Medium · 5 Small</p>
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

      {loading ? (
        <p className="p-6 text-zinc-500 text-sm">Loading…</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sections.map((sec) => {
                const limit = LIMITS[sec.id];
                const { done, total } = progress(sec.ids);
                const pct = limit > 0 ? (total / limit) * 100 : 0;
                return (
                  <Drop
                    key={sec.id}
                    id={sec.id}
                    className="bg-zinc-950 border border-zinc-900 rounded-xl"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
                      <div>
                        <h3 className="text-sm font-semibold">{sec.title}</h3>
                        <p className="text-xs text-zinc-500">{sec.subtitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">
                          {total}/{limit} · {done} done
                        </p>
                        <div className="mt-1 h-1 w-24 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-2 min-h-16">
                      {sec.ids.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">Drop a task here</p>
                      ) : (
                        sec.ids.map((id) => {
                          const t = byId.get(id);
                          if (!t) return null;
                          return <Card key={id} t={t} onToggle={onToggle} />;
                        })
                      )}
                    </div>
                  </Drop>
                );
              })}

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                <label className="text-sm font-semibold block mb-2">How did today go?</label>
                <textarea
                  value={plan.reflection ?? ''}
                  onChange={(e) => setLocalPlan({ ...plan, reflection: e.target.value })}
                  placeholder="One note to future you…"
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                />
              </div>
            </div>

            <Drop
              id={POOL_ID}
              className="w-72 shrink-0 border-l border-zinc-900 bg-zinc-950 flex flex-col"
            >
              <div className="px-4 py-3 border-b border-zinc-900">
                <h3 className="text-sm font-semibold">Unplanned</h3>
                <p className="text-xs text-zinc-500">
                  {pool.length} task{pool.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {pool.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">All planned.</p>
                ) : (
                  pool.map((t) => <Card key={t.id} t={t} onToggle={onToggle} />)
                )}
              </div>
            </Drop>
          </div>

          <DragOverlay>
            {dragging && (
              <div className="px-3 py-2 bg-zinc-900 border border-accent rounded-lg text-sm text-white shadow-2xl">
                {dragging.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
