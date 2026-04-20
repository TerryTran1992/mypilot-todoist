import { Todo } from '../types';
import Icon from './Icon';
import { deleteTodo, toggleComplete } from '../store/todos';
import { openTask } from '../store/selection';
import SubtaskProgress from './SubtaskProgress';

export default function TodoRow({ t, onError }: { t: Todo; onError: (msg: string) => void }) {
  async function handleToggle() {
    try {
      await toggleComplete(t);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDelete() {
    try {
      await deleteTodo(t.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <li className="flex items-center gap-3 px-6 py-3 border-b border-zinc-900 hover:bg-zinc-900/50 transition group">
      <button
        onClick={handleToggle}
        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition ${
          t.is_completed ? 'bg-accent border-accent' : 'border-zinc-600 hover:border-accent'
        }`}
        aria-label={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {t.is_completed && <Icon name="check" size={12} className="text-black" />}
      </button>

      <button
        onClick={() => openTask(t.id)}
        className={`flex-1 text-left text-sm cursor-pointer ${
          t.is_completed ? 'line-through text-zinc-500' : 'text-zinc-100'
        } hover:text-accent transition`}
      >
        {t.title}
      </button>

      <SubtaskProgress todoId={t.id} todo={t} />

      {t.priority !== 'medium' && (
        <span
          className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
            t.priority === 'urgent'
              ? 'bg-red-950 text-red-300'
              : t.priority === 'high'
              ? 'bg-orange-950 text-orange-300'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {t.priority}
        </span>
      )}

      <button
        onClick={handleDelete}
        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition"
        aria-label="Delete"
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
}
