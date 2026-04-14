import { useEffect, useMemo, useRef, useState } from 'react';
import { useTodos, updateTodo, deleteTodo, toggleComplete } from '../store/todos';
import { closeTask, useSelectedId } from '../store/selection';
import api, { ApiError, NetworkError } from '../lib/api';
import { isTempId } from '../lib/sync';
import { Category, EnergyType, Priority, Todo, TodoComment } from '../types';
import Icon from './Icon';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const ENERGIES: { id: EnergyType; label: string }[] = [
  { id: 'deep_focus', label: 'Deep Focus' },
  { id: 'quick_win', label: 'Quick Win' },
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
        <button
          onClick={closeTask}
          className="text-zinc-500 hover:text-white p-1 cursor-pointer"
          aria-label="Close"
        >
          <Icon name="x" size={16} />
        </button>
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

        <Comments todoId={todo.id} />
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

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Comments({ todoId }: { todoId: string }) {
  const [items, setItems] = useState<TodoComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isTemp = isTempId(todoId);

  useEffect(() => {
    if (isTemp) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api
      .get<TodoComment[]>(`/todos/${todoId}/comments`)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) {
          if (e instanceof NetworkError) setErr('Comments load when you reconnect.');
          else if (e instanceof ApiError) setErr(e.message);
          else setErr('Failed to load comments');
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todoId, isTemp]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isTemp) return;
    setPosting(true);
    setErr(null);
    try {
      const created = await api.post<TodoComment>(`/todos/${todoId}/comments`, { content });
      setItems((prev) => [...(prev ?? []), created]);
      setDraft('');
    } catch (e) {
      if (e instanceof NetworkError) setErr('Offline — try again when reconnected.');
      else if (e instanceof ApiError) setErr(e.message);
      else setErr('Failed to post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="pt-4 border-t border-zinc-900">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
        Comments {items && items.length > 0 && <span className="text-zinc-600">· {items.length}</span>}
      </p>

      {isTemp ? (
        <p className="text-xs text-zinc-600 italic">Save the task first to add comments.</p>
      ) : loading && !items ? (
        <p className="text-xs text-zinc-600">Loading…</p>
      ) : items && items.length === 0 ? (
        <p className="text-xs text-zinc-600 italic mb-3">No comments yet.</p>
      ) : (
        <ul className="space-y-3 mb-3">
          {items?.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-zinc-300 font-medium">{c.user_name ?? 'You'}</span>
                <span className="text-[11px] text-zinc-600">{relativeTime(c.created_at)}</span>
              </div>
              <p className="text-zinc-200 whitespace-pre-wrap break-words">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      {!isTemp && (
        <form onSubmit={handlePost} className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handlePost(e);
              }
            }}
            rows={2}
            placeholder="Add a comment…  (⌘↵ to post)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="px-3 py-1 text-xs bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-medium rounded cursor-pointer transition"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}
    </section>
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
