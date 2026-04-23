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
    <li className="flex items-center gap-3 px-6 py-3 border-b border-zinc-900/60 hover:bg-surface-raised/50 transition-all duration-200 group">
      <button
        onClick={handleToggle}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${
          t.is_completed
            ? 'bg-accent border-accent scale-95'
            : 'border-zinc-600 hover:border-accent hover:shadow-sm hover:shadow-accent/20'
        }`}
        aria-label={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {t.is_completed && <Icon name="check" size={12} className="text-black" />}
      </button>

      <button
        onClick={() => openTask(t.id)}
        className={`flex-1 text-left text-sm cursor-pointer font-medium transition-colors duration-200 ${
          t.is_completed ? 'line-through text-zinc-600' : 'text-zinc-200 hover:text-accent'
        }`}
      >
        {t.title}
      </button>

      <SubtaskProgress todoId={t.id} todo={t} />

      {t.recurrence_frequency && (
        <span className="text-accent/60" title={`Repeats ${t.recurrence_frequency}`}>
          <Icon name="repeat" size={13} />
        </span>
      )}

      {t.priority !== 'medium' && (
        <span
          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full tracking-wide ${
            t.priority === 'urgent'
              ? 'bg-red-950/80 text-red-300 border border-red-900/40'
              : t.priority === 'high'
              ? 'bg-orange-950/80 text-orange-300 border border-orange-900/40'
              : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/40'
          }`}
        >
          {t.priority}
        </span>
      )}

      <button
        onClick={handleDelete}
        className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200"
        aria-label="Delete"
      >
        <Icon name="trash" size={15} />
      </button>
    </li>
  );
}
