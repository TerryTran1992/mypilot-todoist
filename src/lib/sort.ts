import { Todo } from '../types';

const PRIORITY_RANK: Record<Todo['priority'], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Compare two todos for display order: higher priority_score first.
 * Fallback to priority enum rank, then created_at desc (newest first).
 * `priority_score` is server-calculated (0–1000).
 */
export function byScore(a: Todo, b: Todo): number {
  const sa = a.priority_score ?? 0;
  const sb = b.priority_score ?? 0;
  if (sa !== sb) return sb - sa;
  const pa = PRIORITY_RANK[a.priority];
  const pb = PRIORITY_RANK[b.priority];
  if (pa !== pb) return pb - pa;
  return b.created_at.localeCompare(a.created_at);
}
