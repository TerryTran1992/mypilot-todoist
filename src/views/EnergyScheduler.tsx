import { useMemo, useState } from 'react';
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
import { useTodos, updateTodo } from '../store/todos';
import { openTask } from '../store/selection';
import { EnergyType, Todo } from '../types';
import Icon from '../components/Icon';

type Block = {
  id: 'deep' | 'quick';
  label: string;
  energy: EnergyType;
  hint: string;
  start: string;
  end: string;
  accent: string;
  dot: string;
};

const BLOCKS: Block[] = [
  {
    id: 'deep',
    label: 'Deep Focus',
    energy: 'deep_focus',
    hint: 'Hard problems, strategic thinking, anything that needs uninterrupted concentration',
    start: '08:00',
    end: '12:00',
    accent: 'border-l-purple-500',
    dot: 'bg-purple-500',
  },
  {
    id: 'quick',
    label: 'Quick Wins',
    energy: 'quick_win',
    hint: 'Sub-15-min tasks: replies, approvals, small decisions',
    start: '13:00',
    end: '18:00',
    accent: 'border-l-yellow-500',
    dot: 'bg-yellow-500',
  },
];

const UNSCHEDULED_ID = 'unscheduled';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentBlockId(): Block['id'] {
  const h = new Date().getHours();
  return h < 12 ? 'deep' : 'quick';
}

function DraggableTodo({ t }: { t: Todo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm select-none ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {t.priority !== 'medium' && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            t.priority === 'urgent'
              ? 'bg-red-500'
              : t.priority === 'high'
              ? 'bg-orange-500'
              : 'bg-zinc-600'
          }`}
        />
      )}
      <span
        {...listeners}
        {...attributes}
        onClick={() => openTask(t.id)}
        className="flex-1 truncate text-zinc-100 cursor-pointer hover:text-accent transition"
      >
        {t.title}
      </span>
    </div>
  );
}

function Droppable({
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
      className={`${className ?? ''} ${isOver ? 'bg-zinc-900/60' : ''} transition-colors`}
    >
      {children}
    </div>
  );
}

export default function EnergyScheduler() {
  const { todos, loading, error, setError } = useTodos();
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const today = todayKey();
  const nowBlock = currentBlockId();

  const { byBlock, unscheduled } = useMemo(() => {
    const byBlock: Record<Block['id'], Todo[]> = {
      deep: [],
      quick: [],
    };
    const unscheduled: Todo[] = [];

    for (const t of todos) {
      if (t.is_completed) continue;
      const scheduledToday = t.time_block_date?.slice(0, 10) === today && t.energy_type;
      if (!scheduledToday) {
        unscheduled.push(t);
        continue;
      }
      const block = BLOCKS.find((b) => b.energy === t.energy_type);
      if (block) byBlock[block.id].push(t);
      else unscheduled.push(t);
    }

    for (const k of Object.keys(byBlock) as Block['id'][]) {
      byBlock[k].sort((a, b) => (a.time_block_order ?? 0) - (b.time_block_order ?? 0));
    }
    return { byBlock, unscheduled };
  }, [todos, today]);

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    if (!e.over) return;
    const todoId = String(e.active.id);
    const targetId = String(e.over.id);
    const t = todos.find((x) => x.id === todoId);
    if (!t) return;

    try {
      if (targetId === UNSCHEDULED_ID) {
        if (!t.energy_type && !t.time_block_date) return;
        await updateTodo(todoId, {
          energy_type: null,
          time_block_date: null,
          time_block_start: null,
          time_block_end: null,
          time_block_order: null,
        });
        return;
      }
      const block = BLOCKS.find((b) => b.id === targetId);
      if (!block) return;
      if (t.energy_type === block.energy && t.time_block_date?.slice(0, 10) === today) return;
      const order = byBlock[block.id].length;
      await updateTodo(todoId, {
        energy_type: block.energy,
        time_block_date: today,
        time_block_start: block.start,
        time_block_end: block.end,
        time_block_order: order,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    }
  }

  async function autoArrange() {
    try {
      // Simple heuristic: place by existing energy_type; otherwise urgent/high → morning, rest → afternoon.
      for (const t of unscheduled) {
        let energy: EnergyType = t.energy_type ?? 'quick_win';
        if (!t.energy_type) {
          if (t.priority === 'urgent' || t.priority === 'high') energy = 'deep_focus';
        }
        const block = BLOCKS.find((b) => b.energy === energy)!;
        await updateTodo(t.id, {
          energy_type: energy,
          time_block_date: today,
          time_block_start: block.start,
          time_block_end: block.end,
          time_block_order: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-arrange failed');
    }
  }

  const dragging = dragId ? todos.find((t) => t.id === dragId) : null;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Energy Scheduler</h1>
          <p className="text-xs text-zinc-500">Match tasks to when your brain is best for them · Today</p>
        </div>
        <button
          onClick={autoArrange}
          disabled={unscheduled.length === 0}
          className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 rounded-lg cursor-pointer transition"
        >
          Auto-arrange
        </button>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {BLOCKS.map((b) => (
                <Droppable
                  key={b.id}
                  id={b.id}
                  className={`border-l-4 ${b.accent} bg-zinc-950 border border-zinc-900 rounded-lg ${
                    b.id === nowBlock ? 'ring-1 ring-accent/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${b.dot}`} />
                        <h3 className="text-sm font-semibold">{b.label}</h3>
                        <span className="text-xs text-zinc-500">
                          {b.start}–{b.end}
                        </span>
                        {b.id === nowBlock && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                            now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{b.hint}</p>
                    </div>
                    <span className="text-xs text-zinc-500">{byBlock[b.id].length}</span>
                  </div>
                  <div className="p-3 min-h-20 space-y-2">
                    {byBlock[b.id].length === 0 ? (
                      <p className="text-xs text-zinc-600 italic px-1 py-2">Drop a task here</p>
                    ) : (
                      byBlock[b.id].map((t) => <DraggableTodo key={t.id} t={t} />)
                    )}
                  </div>
                </Droppable>
              ))}
            </div>

            <Droppable
              id={UNSCHEDULED_ID}
              className="w-72 shrink-0 border-l border-zinc-900 bg-zinc-950 flex flex-col"
            >
              <div className="px-4 py-3 border-b border-zinc-900">
                <h3 className="text-sm font-semibold">Unscheduled</h3>
                <p className="text-xs text-zinc-500">{unscheduled.length} task{unscheduled.length === 1 ? '' : 's'}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {unscheduled.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">Everything's scheduled.</p>
                ) : (
                  unscheduled.map((t) => <DraggableTodo key={t.id} t={t} />)
                )}
              </div>
            </Droppable>
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
