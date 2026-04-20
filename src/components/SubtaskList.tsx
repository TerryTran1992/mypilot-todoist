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
import { Category, DelegationStatus, EnergyType, Priority, Todo } from '../types';
import {
  useSubtasks,
  createSubtask,
  toggleSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
} from '../store/subtasks';
import { toggleComplete } from '../store/todos';
import { useTodos } from '../store/todos';
import Icon from './Icon';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const CATEGORIES: Category[] = ['work', 'personal', 'family', 'health', 'learning'];
const ENERGIES: { id: EnergyType; label: string }[] = [
  { id: 'deep_focus', label: 'Deep Focus' },
  { id: 'quick_win', label: 'Quick Win' },
];

function SortableRow({
  sub,
  todoId,
  onExpand,
  isExpanded,
}: {
  sub: Todo;
  todoId: string;
  onExpand: (subId: string | null) => void;
  isExpanded: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasDetails = sub.category || sub.energy_type || sub.deadline || sub.delegated_to || sub.estimated_minutes;

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
          onClick={() => onExpand(isExpanded ? null : sub.id)}
          className={`flex-1 text-sm cursor-pointer select-none ${
            sub.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
          }`}
        >
          {sub.title}
        </span>
        {hasDetails && !isExpanded && (
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
          </div>
        )}
        <button
          onClick={() => void deleteSubtask(todoId, sub.id)}
          className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition shrink-0"
          aria-label="Delete subtask"
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      {isExpanded && (
        <SubtaskDetail sub={sub} todoId={todoId} onClose={() => onExpand(null)} />
      )}
    </div>
  );
}

function SubtaskDetail({ sub, todoId, onClose }: { sub: Todo; todoId: string; onClose: () => void }) {
  const [title, setTitle] = useState(sub.title);
  const [content, setContent] = useState(sub.content ?? '');
  const [delegatedTo, setDelegatedTo] = useState(sub.delegated_to ?? '');

  useEffect(() => {
    setTitle(sub.title);
    setContent(sub.content ?? '');
    setDelegatedTo(sub.delegated_to ?? '');
  }, [sub.id]);

  function patch(p: Partial<Todo>) {
    void updateSubtask(todoId, sub.id, p);
  }

  function commitTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== sub.title) patch({ title: trimmed });
  }

  function commitContent() {
    if (content !== (sub.content ?? '')) patch({ content });
  }

  function commitDelegatedTo() {
    const trimmed = delegatedTo.trim();
    if (trimmed !== (sub.delegated_to ?? '')) {
      const update: Partial<Todo> = { delegated_to: trimmed || null };
      if (trimmed && !sub.delegation_status) {
        update.delegation_status = 'delegated';
        update.delegated_at = new Date().toISOString();
      }
      if (!trimmed) {
        update.delegation_status = null;
        update.delegated_at = null;
      }
      patch(update);
    }
  }

  return (
    <div className="ml-7 pb-3 space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none border-b border-zinc-800 focus:border-accent pb-1"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={commitContent}
        rows={2}
        placeholder="Notes..."
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:border-accent focus:outline-none resize-none"
      />

      <div>
        <Label text="Priority" />
        <div className="flex flex-wrap gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => patch({ priority: p })}
              className={`px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition capitalize ${
                sub.priority === p
                  ? p === 'urgent' ? 'bg-red-900 text-red-200'
                  : p === 'high' ? 'bg-orange-900 text-orange-200'
                  : p === 'medium' ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-800 text-zinc-300'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >{p}</button>
          ))}
        </div>
      </div>

      <div>
        <Label text="Category" />
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => patch({ category: sub.category === c ? null : c })}
              className={`px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition capitalize ${
                sub.category === c ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >{c}</button>
          ))}
        </div>
      </div>

      <div>
        <Label text="Energy" />
        <div className="flex flex-wrap gap-1">
          {ENERGIES.map((e) => (
            <button
              key={e.id}
              onClick={() => patch({ energy_type: sub.energy_type === e.id ? null : e.id })}
              className={`px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition ${
                sub.energy_type === e.id ? 'bg-accent text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >{e.label}</button>
          ))}
        </div>
      </div>

      <div>
        <Label text="Delegated to" />
        <input
          type="text"
          value={delegatedTo}
          onChange={(e) => setDelegatedTo(e.target.value)}
          onBlur={commitDelegatedTo}
          placeholder="Name..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs focus:border-accent focus:outline-none"
        />
      </div>

      {sub.delegated_to && (
        <div>
          <Label text="Status" />
          <div className="flex flex-wrap gap-1">
            {(['delegated', 'in_progress', 'done'] as DelegationStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  const update: Partial<Todo> = { delegation_status: s };
                  if (s === 'done') {
                    update.is_completed = true;
                    update.completed_at = new Date().toISOString();
                  }
                  patch(update);
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition capitalize ${
                  sub.delegation_status === s
                    ? s === 'done' ? 'bg-accent text-black'
                    : s === 'in_progress' ? 'bg-sky-900 text-sky-200'
                    : 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >{s === 'in_progress' ? 'In Progress' : s === 'delegated' ? 'Todo' : 'Done'}</button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label text="Deadline" />
          <input
            type="date"
            value={sub.deadline ? sub.deadline.slice(0, 10) : ''}
            onChange={(e) => patch({ deadline: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs focus:border-accent focus:outline-none [color-scheme:dark]"
          />
        </div>
        <div>
          <Label text="Estimate (min)" />
          <input
            type="number"
            min={0}
            value={sub.estimated_minutes ?? ''}
            onChange={(e) => patch({ estimated_minutes: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <button
        onClick={onClose}
        className="text-[10px] text-zinc-500 hover:text-white cursor-pointer transition"
      >
        Collapse
      </button>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{text}</p>;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
                      onExpand={setExpandedId}
                      isExpanded={expandedId === sub.id}
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
