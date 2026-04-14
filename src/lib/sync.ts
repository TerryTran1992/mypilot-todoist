import { Todo } from '../types';

export type QueueOp =
  | { kind: 'create'; tempId: string; body: { title: string; priority?: Todo['priority'] } }
  | { kind: 'update'; id: string; patch: Partial<Todo> }
  | { kind: 'delete'; id: string };

const QUEUE_KEY = 'mypilot_queue';

export function loadQueue(): QueueOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueueOp[];
  } catch {
    return [];
  }
}

export function saveQueue(q: QueueOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event('queue:changed'));
}

export function enqueue(op: QueueOp) {
  const q = loadQueue();
  q.push(op);
  saveQueue(q);
}

export function queueLength() {
  return loadQueue().length;
}

export function isTempId(id: string) {
  return id.startsWith('temp_');
}

/** Replace all occurrences of tempId with realId inside the queue. */
export function remapInQueue(tempId: string, realId: string) {
  const q = loadQueue();
  const next = q.map((op) => {
    if (op.kind === 'update' && op.id === tempId) return { ...op, id: realId };
    if (op.kind === 'delete' && op.id === tempId) return { ...op, id: realId };
    return op;
  });
  saveQueue(next);
}
