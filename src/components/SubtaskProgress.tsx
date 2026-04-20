import { Todo } from '../types';
import { getSubtaskProgress, useSubtaskProgressListener } from '../store/subtasks';

export default function SubtaskProgress({ todoId, todo }: { todoId: string; todo?: Todo }) {
  useSubtaskProgressListener();

  const cached = getSubtaskProgress(todoId);
  const done = cached?.done ?? (todo?.subtask_completed_count || 0);
  const total = cached?.total ?? (todo?.subtask_count || 0);

  if (total === 0) return null;

  const pct = Math.round((done / total) * 100);

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0">
      <span className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <span
          className="block h-full bg-accent rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </span>
      {done}/{total}
    </span>
  );
}
