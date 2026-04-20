import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Todo } from '../types';
import {
  useSubtasks,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  reorderSubtasks,
} from '../store/subtasks';
import { useTodos } from '../store/todos';
import { toggleComplete } from '../store/todos';
import { openTask } from '../store/selection';
import Icon from './Icon';

function SortableRow({
  sub,
  todoId,
}: {
  sub: Todo;
  todoId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-b border-zinc-900/50 last:border-0 ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-2 py-1.5 group">
        <span
          {...attributes}
          {...listeners}
          className="text-zinc-700 hover:text-zinc-400 cursor-grab shrink-0"
        >
          <Icon name="grip-vertical" size={12} />
        </span>
        <button
          onClick={() => void toggleSubtask(todoId, sub)}
          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition ${
            sub.is_completed ? 'bg-accent border-accent' : 'border-zinc-600 hover:border-accent'
          }`}
        >
          {sub.is_completed && <Icon name="check" size={8} className="text-black" />}
        </button>
        <span
          onClick={() => openTask(sub.id)}
          className={`flex-1 text-sm cursor-pointer select-none ${
            sub.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
          }`}
        >
          {sub.title}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {sub.priority !== 'medium' && (
            <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${
              sub.priority === 'urgent' ? 'bg-red-950 text-red-300'
              : sub.priority === 'high' ? 'bg-orange-950 text-orange-300'
              : 'bg-zinc-800 text-zinc-400'
            }`}>{sub.priority}</span>
          )}
          {sub.category && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">{sub.category}</span>
          )}
          {sub.deadline && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {new Date(sub.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => void deleteSubtask(todoId, sub.id)}
          className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition shrink-0"
          aria-label="Delete subtask"
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}

export default function SubtaskList({
  todoId,
  isParentTemp,
}: {
  todoId: string;
  isParentTemp: boolean;
}) {
  const { subtasks, loading } = useSubtasks(todoId);
  const { todos } = useTodos();
  const [input, setInput] = useState('');
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptTimer = useRef<ReturnType<typeof setTimeout>>();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const parentTodo = todos.find((t) => t.id === todoId);

  const doneCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;

  useEffect(() => {
    return () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    };
  }, []);

  const checkAllDone = useCallback(
    (subs: Todo[]) => {
      if (subs.length > 0 && subs.every((s) => s.is_completed) && parentTodo && !parentTodo.is_completed) {
        setShowCompletePrompt(true);
        if (promptTimer.current) clearTimeout(promptTimer.current);
        promptTimer.current = setTimeout(() => setShowCompletePrompt(false), 5000);
      }
    },
    [parentTodo],
  );

  useEffect(() => {
    checkAllDone(subtasks);
  }, [subtasks, checkAllDone]);

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed || !parentTodo) return;
    setInput('');
    await createSubtask(todoId, {
      title: trimmed,
      priority: parentTodo.priority,
      category: parentTodo.category,
      energy_type: parentTodo.energy_type,
      deadline: parentTodo.deadline,
    });
    inputRef.current?.focus();
  }

  function handleCompleteParent() {
    if (parentTodo) {
      void toggleComplete(parentTodo);
    }
    setShowCompletePrompt(false);
  }

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (activeId === overId) return;
    const oldIndex = subtasks.findIndex((s) => s.id === activeId);
    const newIndex = subtasks.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(subtasks, oldIndex, newIndex);
    void reorderSubtasks(todoId, reordered.map((s) => s.id));
  }

  const dragging = dragId ? subtasks.find((s) => s.id === dragId) : null;

  return (
    <section className="pt-4 border-t border-zinc-900">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
        Subtasks
        {totalCount > 0 && (
          <span className="text-zinc-600">
            {' '}· {doneCount}/{totalCount}
          </span>
        )}
      </p>

      {isParentTemp ? (
        <p className="text-xs text-zinc-600 italic">Save the task first to add subtasks.</p>
      ) : loading && subtasks.length === 0 ? (
        <p className="text-xs text-zinc-600">Loading...</p>
      ) : (
        <>
          {subtasks.length > 0 && (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="mb-2">
                  {subtasks.map((sub) => (
                    <SortableRow
                      key={sub.id}
                      sub={sub}
                      todoId={todoId}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {dragging && (
                  <div className="flex items-center gap-2 py-1.5 bg-zinc-900 rounded px-2 shadow-2xl">
                    <span className="text-zinc-400">
                      <Icon name="grip-vertical" size={12} />
                    </span>
                    <span className="text-sm text-zinc-100">{dragging.title}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {showCompletePrompt && (
            <div className="mb-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg flex items-center justify-between">
              <span className="text-xs text-accent">All subtasks done!</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCompletePrompt(false)}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer transition"
                >
                  Not yet
                </button>
                <button
                  onClick={handleCompleteParent}
                  className="text-[11px] px-2 py-0.5 bg-accent text-black rounded cursor-pointer transition hover:bg-accent/90"
                >
                  Complete
                </button>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
              if (e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Add a subtask..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
          />
        </>
      )}
    </section>
  );
}
