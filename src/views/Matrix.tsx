import { useCallback, useMemo, useState } from 'react';
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
import { Todo } from '../types';
import {
  Quadrant,
  clearMatrixFor,
  getMatrix,
  setMatrixAssignment,
} from '../lib/local';
import { useLocalStore } from '../lib/useLocalStore';
import Icon from '../components/Icon';

type QuadrantDef = {
  id: Quadrant;
  title: string;
  subtitle: string;
  border: string;
  bg: string;
};

const QUADRANTS: QuadrantDef[] = [
  {
    id: 'do',
    title: 'Do First',
    subtitle: 'Urgent · Important',
    border: 'border-red-900',
    bg: 'bg-red-950/20',
  },
  {
    id: 'schedule',
    title: 'Schedule',
    subtitle: 'Not Urgent · Important',
    border: 'border-sky-900',
    bg: 'bg-sky-950/20',
  },
  {
    id: 'delegate',
    title: 'Delegate',
    subtitle: 'Urgent · Not Important',
    border: 'border-yellow-900',
    bg: 'bg-yellow-950/20',
  },
  {
    id: 'eliminate',
    title: 'Eliminate',
    subtitle: 'Not Urgent · Not Important',
    border: 'border-zinc-800',
    bg: 'bg-zinc-950',
  },
];

const POOL_ID = 'matrix-pool';

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
        aria-label="Toggle"
      >
        {t.is_completed && <Icon name="check" size={10} className="text-black" />}
      </button>
      <span
        {...listeners}
        {...attributes}
        className={`flex-1 truncate cursor-grab active:cursor-grabbing select-none ${
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

export default function Matrix() {
  const { todos, loading, error, setError } = useTodos();
  const matrix = useLocalStore('mypilot_matrix', getMatrix);
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const openTodos = useMemo(() => todos.filter((t) => !t.is_completed), [todos]);

  useMemo(() => {
    const ids = new Set(todos.map((t) => t.id));
    clearMatrixFor(ids);
  }, [todos]);

  const grouped = useMemo(() => {
    const byQ: Record<Quadrant, Todo[]> = { do: [], schedule: [], delegate: [], eliminate: [] };
    const pool: Todo[] = [];
    for (const t of openTodos) {
      const q = matrix[t.id];
      if (q) byQ[q].push(t);
      else pool.push(t);
    }
    return { byQ, pool };
  }, [openTodos, matrix]);

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

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    if (!e.over) return;
    const todoId = String(e.active.id);
    const target = String(e.over.id);
    if (target === POOL_ID) {
      setMatrixAssignment(todoId, null);
    } else if (QUADRANTS.some((q) => q.id === target)) {
      setMatrixAssignment(todoId, target as Quadrant);
    }
  }

  const dragging = dragId ? todos.find((t) => t.id === dragId) : null;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Eisenhower Matrix</h1>
          <p className="text-xs text-zinc-500">Drag tasks into quadrants to decide priority</p>
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
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-6 min-h-0">
              {QUADRANTS.map((q) => (
                <Drop
                  key={q.id}
                  id={q.id}
                  className={`flex flex-col border ${q.border} ${q.bg} rounded-xl min-h-0`}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
                    <div>
                      <h3 className="text-sm font-semibold">{q.title}</h3>
                      <p className="text-xs text-zinc-500">{q.subtitle}</p>
                    </div>
                    <span className="text-xs text-zinc-500">{grouped.byQ[q.id].length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {grouped.byQ[q.id].length === 0 ? (
                      <p className="text-xs text-zinc-600 italic">Drop tasks here</p>
                    ) : (
                      grouped.byQ[q.id].map((t) => <Card key={t.id} t={t} onToggle={onToggle} />)
                    )}
                  </div>
                </Drop>
              ))}
            </div>

            <Drop
              id={POOL_ID}
              className="w-72 shrink-0 border-l border-zinc-900 bg-zinc-950 flex flex-col"
            >
              <div className="px-4 py-3 border-b border-zinc-900">
                <h3 className="text-sm font-semibold">Unsorted</h3>
                <p className="text-xs text-zinc-500">
                  {grouped.pool.length} task{grouped.pool.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {grouped.pool.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">Everything sorted.</p>
                ) : (
                  grouped.pool.map((t) => <Card key={t.id} t={t} onToggle={onToggle} />)
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
