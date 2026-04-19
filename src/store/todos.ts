import { useCallback, useEffect, useState } from 'react';
import api, { NetworkError } from '../lib/api';
import { Todo } from '../types';
import { enqueue, isTempId, loadQueue, remapInQueue, saveQueue } from '../lib/sync';
import { remapLocalId } from '../lib/local';
import { isOnline, subscribe as subscribeNetwork } from '../lib/network';
import { getToken } from '../lib/auth';

const CACHE_KEY = 'mypilot_todos_cache';

function loadCache(): Todo[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as Todo[];
  } catch {
    return [];
  }
}

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

let cache: Todo[] = loadCache();
const listeners = new Set<(todos: Todo[]) => void>();

function notify() {
  for (const l of listeners) l(cache);
}

function setCache(next: Todo[]) {
  cache = next;
  saveCache();
  notify();
}

function tempId() {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `temp_${rnd}`;
}

function optimisticTodo(input: { title: string; priority?: Todo['priority'] }): Todo {
  return {
    id: tempId(),
    title: input.title,
    priority: input.priority ?? 'medium',
    is_completed: false,
    is_pinned: false,
    created_at: new Date().toISOString(),
    completed_at: null,
    energy_type: null,
    time_block_date: null,
    time_block_start: null,
    time_block_end: null,
    time_block_order: null,
  };
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(cache);
  const [loading, setLoading] = useState(cache.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setTodos);
    return () => {
      listeners.delete(setTodos);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await api.get<Todo[]>('/todos?limit=200');
      // Preserve any optimistic-only temp entries that haven't been flushed yet
      const temps = cache.filter((t) => isTempId(t.id));
      setCache([...temps, ...fresh]);
      void drainQueue();
    } catch (err) {
      if (!(err instanceof NetworkError)) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
      // On network error: keep the persisted cache; no user-facing error.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { todos, loading, error, setError, refresh };
}

export async function createTodo(input: { title: string; priority?: Todo['priority'] }) {
  const optimistic = optimisticTodo(input);
  setCache([optimistic, ...cache]);

  try {
    const created = await api.post<Todo>('/todos', input);
    setCache(cache.map((t) => (t.id === optimistic.id ? created : t)));
    return created;
  } catch (err) {
    if (err instanceof NetworkError) {
      enqueue({ kind: 'create', tempId: optimistic.id, body: input });
      return optimistic;
    }
    setCache(cache.filter((t) => t.id !== optimistic.id));
    throw err;
  }
}

export async function updateTodo(id: string, patch: Partial<Todo>) {
  const prev = cache;
  setCache(cache.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  if (isTempId(id)) {
    // Parent create hasn't flushed yet — queue the update so it runs after the create resolves.
    enqueue({ kind: 'update', id, patch });
    return cache.find((t) => t.id === id)!;
  }

  try {
    const updated = await api.put<Todo>(`/todos/${id}`, patch);
    setCache(cache.map((t) => (t.id === id ? updated : t)));
    return updated;
  } catch (err) {
    if (err instanceof NetworkError) {
      enqueue({ kind: 'update', id, patch });
      return cache.find((t) => t.id === id)!;
    }
    setCache(prev);
    throw err;
  }
}

export async function deleteTodo(id: string) {
  const prev = cache;
  setCache(cache.filter((t) => t.id !== id));

  if (isTempId(id)) {
    // If the create is still queued, remove it; nothing to delete on the server.
    const q = loadQueue();
    const withoutCreate = q.filter((op) => !(op.kind === 'create' && op.tempId === id));
    saveQueue(withoutCreate);
    return;
  }

  try {
    await api.delete(`/todos/${id}`);
  } catch (err) {
    if (err instanceof NetworkError) {
      enqueue({ kind: 'delete', id });
      return;
    }
    setCache(prev);
    throw err;
  }
}

export async function toggleComplete(t: Todo) {
  const nextCompleted = !t.is_completed;
  return updateTodo(t.id, {
    is_completed: nextCompleted,
    completed_at: nextCompleted ? new Date().toISOString() : null,
  });
}

// ---- Queue drain ----

let draining = false;

export async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    let q = loadQueue();
    while (q.length > 0) {
      const op = q[0];
      try {
        if (op.kind === 'create') {
          const created = await api.post<Todo>('/todos', op.body);
          setCache(cache.map((t) => (t.id === op.tempId ? created : t)));
          remapLocalId(op.tempId, created.id);
          remapInQueue(op.tempId, created.id);
        } else if (op.kind === 'update') {
          if (isTempId(op.id)) break; // create not yet flushed — stop drain
          const updated = await api.put<Todo>(`/todos/${op.id}`, op.patch);
          setCache(cache.map((t) => (t.id === op.id ? updated : t)));
        } else if (op.kind === 'delete') {
          if (isTempId(op.id)) break;
          await api.delete(`/todos/${op.id}`);
        }
        q = loadQueue();
        q.shift();
        saveQueue(q);
      } catch (err) {
        if (err instanceof NetworkError) return; // still offline
        // Permanent server error — drop the op so we don't loop forever.
        console.error('[sync] dropping queued op after server error:', err);
        q = loadQueue();
        q.shift();
        saveQueue(q);
      }
    }
  } finally {
    draining = false;
  }
}

// Auto-drain on network recovery
subscribeNetwork((online) => {
  if (online) {
    void drainQueue();
    void refreshFromServer();
  }
});

// ---- Background refresh ----

let refreshInFlight = false;

export async function refreshFromServer() {
  if (refreshInFlight) return;
  if (!isOnline()) return;
  if (!getToken()) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  refreshInFlight = true;
  try {
    const fresh = await api.get<Todo[]>('/todos?limit=200');
    const temps = cache.filter((t) => isTempId(t.id));
    setCache([...temps, ...fresh]);
  } catch {
    // Silent — keep showing the cache.
  } finally {
    refreshInFlight = false;
  }
}

// Poll every 5 min while document is visible. Re-poll immediately on focus/visibility.
const POLL_INTERVAL_MS = 5 * 60_000;

if (typeof window !== 'undefined') {
  setInterval(() => void refreshFromServer(), POLL_INTERVAL_MS);
  window.addEventListener('focus', () => void refreshFromServer());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshFromServer();
  });

  const w = window as unknown as { api?: { onTodosRefresh?: (cb: () => void) => () => void } };
  w.api?.onTodosRefresh?.(() => void refreshFromServer());
}
