import { useEffect, useMemo, useRef, useState } from 'react';
import { useTodos, updateTodo, deleteTodo, toggleComplete } from '../store/todos';
import { closeTask, useSelectedId } from '../store/selection';
import { Category, EnergyType, Priority, Todo } from '../types';
import Icon from './Icon';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const ENERGIES: { id: EnergyType; label: string }[] = [
  { id: 'deep_focus', label: 'Deep Focus' },
  { id: 'people', label: 'People' },
  { id: 'quick_win', label: 'Quick Win' },
  { id: 'personal', label: 'Personal' },
];
const CATEGORIES: Category[] = ['work', 'personal', 'family', 'health', 'learning'];

function fmtDateTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isoToDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function dateInputToIso(value: string) {
  if (!value) return null;
  return new Date(value + 'T23:59:59').toISOString();
}

export default function TaskDetail() {
  const id = useSelectedId();
  const { todos } = useTodos();
  const todo = useMemo(() => (id ? todos.find((t) => t.id === id) ?? null : null), [id, todos]);

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex justify-end"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeTask();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <aside className="relative w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
        {todo ? <Body todo={todo} /> : <Missing />}
      </aside>
    </div>
  );
}

function Missing() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-zinc-500 text-sm">
      <button onClick={closeTask} className="cursor-pointer underline">
        Task not found · close
      </button>
    </div>
  );
}

function Body({ todo }: { todo: Todo }) {
  const [title, setTitle] = useState(todo.title);
  const [content, setContent] = useState(todo.content ?? '');
  const titleRef = useRef(todo.title);
  const contentRef = useRef(todo.content ?? '');
  const [savingErr, setSavingErr] = useState<string | null>(null);

  // Reset local text when switching to a different task.
  useEffect(() => {
    setTitle(todo.title);
    setContent(todo.content ?? '');
    titleRef.current = todo.title;
    contentRef.current = todo.content ?? '';
  }, [todo.id]);

  // Sync from server-side updates if the user isn't actively editing.
  useEffect(() => {
    if (todo.title !== titleRef.current) {
      setTitle(todo.title);
      titleRef.current = todo.title;
    }
    if ((todo.content ?? '') !== contentRef.current) {
      setContent(todo.content ?? '');
      contentRef.current = todo.content ?? '';
    }
  }, [todo.title, todo.content]);

  async function patch(p: Partial<Todo>) {
    setSavingErr(null);
    try {
      await updateTodo(todo.id, p);
    } catch (err) {
      setSavingErr(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === todo.title) return;
    titleRef.current = trimmed;
    await patch({ title: trimmed });
  }

  async function commitContent() {
    if (content === (todo.content ?? '')) return;
    contentRef.current = content;
    await patch({ content });
  }

  async function handleDelete() {
    closeTask();
    try {
      await deleteTodo(todo.id);
    } catch (err) {
      setSavingErr(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
        <button
          onClick={() => toggleComplete(todo).catch(() => {})}
          className={`flex items-center gap-2 text-xs uppercase tracking-wide cursor-pointer transition ${
            todo.is_completed ? 'text-accent' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
              todo.is_completed ? 'bg-accent border-accent' : 'border-zinc-600'
            }`}
          >
            {todo.is_completed && <Icon name="check" size={10} className="text-black" />}
          </span>
          {todo.is_completed ? 'Completed' : 'Mark complete'}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => patch({ is_pinned: !todo.is_pinned })}
            className={`px-2 py-1 text-xs rounded cursor-pointer transition ${
              todo.is_pinned ? 'bg-amber-900/40 text-amber-300' : 'text-zinc-500 hover:text-white'
            }`}
            title="Pin"
          >
            {todo.is_pinned ? '★ Pinned' : '☆ Pin'}
          </button>
          <button
            onClick={closeTask}
            className="text-zinc-500 hover:text-white p-1 cursor-pointer"
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className={`w-full bg-transparent text-xl font-semibold focus:outline-none ${
              todo.is_completed ? 'line-through text-zinc-500' : 'text-white'
            }`}
            placeholder="Title"
          />
        </div>

        <Field label="Notes">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={commitContent}
            rows={4}
            placeholder="Anything you want to remember…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-accent focus:outline-none resize-none"
          />
        </Field>

        <Field label="Priority">
          <Pills
            options={PRIORITIES}
            value={todo.priority}
            onChange={(v) => patch({ priority: v })}
            color={(p) =>
              p === 'urgent'
                ? 'bg-red-900 text-red-200'
                : p === 'high'
                ? 'bg-orange-900 text-orange-200'
                : p === 'medium'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-800 text-zinc-300'
            }
          />
        </Field>

        <Field label="Status">
          <Pills
            options={['todo', 'doing', 'done'] as const}
            value={todo.status}
            onChange={(v) =>
              patch({
                status: v,
                is_completed: v === 'done',
                completed_at: v === 'done' ? new Date().toISOString() : null,
              })
            }
            color={() => 'bg-zinc-800 text-white'}
          />
        </Field>

        <Field label="Category">
          <Pills
            options={CATEGORIES}
            value={todo.category ?? null}
            onChange={(v) => patch({ category: v === todo.category ? null : v })}
            color={() => 'bg-zinc-800 text-white'}
          />
        </Field>

        <Field label="Energy">
          <div className="flex flex-wrap gap-1">
            {ENERGIES.map((e) => (
              <button
                key={e.id}
                onClick={() =>
                  patch({ energy_type: todo.energy_type === e.id ? null : e.id })
                }
                className={`px-2 py-0.5 text-[11px] rounded-full cursor-pointer transition capitalize ${
                  todo.energy_type === e.id
                    ? 'bg-accent text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline">
            <input
              type="date"
              value={isoToDateInput(todo.deadline)}
              onChange={(e) => patch({ deadline: dateInputToIso(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm focus:border-accent focus:outline-none [color-scheme:dark]"
            />
          </Field>
          <Field label="Estimate (min)">
            <input
              type="number"
              min={0}
              value={todo.estimated_minutes ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                patch({ estimated_minutes: v });
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </Field>
        </div>

        {savingErr && <p className="text-red-400 text-sm">{savingErr}</p>}

        <div className="text-xs text-zinc-600 space-y-0.5 pt-2 border-t border-zinc-900">
          <p>Created · {fmtDateTime(todo.created_at)}</p>
          {todo.completed_at && <p>Completed · {fmtDateTime(todo.completed_at)}</p>}
        </div>
      </div>

      <footer className="px-5 py-3 border-t border-zinc-900 flex justify-between items-center">
        <button
          onClick={handleDelete}
          className="text-sm text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1.5"
        >
          <Icon name="trash" size={14} />
          Delete task
        </button>
        <button
          onClick={closeTask}
          className="text-sm text-zinc-400 hover:text-white cursor-pointer"
        >
          Done
        </button>
      </footer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  color: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2 py-0.5 text-[11px] rounded-full cursor-pointer transition capitalize ${
            value === opt ? color(opt) : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
