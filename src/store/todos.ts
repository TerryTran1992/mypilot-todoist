import { useCallback, useEffect, useState } from 'react';
import api, { ApiError } from '../lib/api';
import { Todo } from '../types';

let cache: Todo[] = [];
const listeners = new Set<(todos: Todo[]) => void>();

function notify() {
  for (const l of listeners) l(cache);
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
      cache = await api.get<Todo[]>('/todos?limit=200');
      notify();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache.length === 0) refresh();
  }, [refresh]);

  return { todos, loading, error, setError, refresh };
}

export async function createTodo(input: { title: string; priority?: Todo['priority'] }) {
  const body = { title: input.title, priority: input.priority ?? 'medium' };
  const created = await api.post<Todo>('/todos', body);
  cache = [created, ...cache];
  notify();
  return created;
}

export async function updateTodo(id: string, patch: Partial<Todo>) {
  const prev = cache;
  cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t));
  notify();
  try {
    const updated = await api.put<Todo>(`/todos/${id}`, patch);
    cache = cache.map((t) => (t.id === id ? updated : t));
    notify();
    return updated;
  } catch (err) {
    cache = prev;
    notify();
    throw err;
  }
}

export async function deleteTodo(id: string) {
  const prev = cache;
  cache = cache.filter((t) => t.id !== id);
  notify();
  try {
    await api.delete(`/todos/${id}`);
  } catch (err) {
    cache = prev;
    notify();
    throw err;
  }
}

export async function toggleComplete(t: Todo) {
  const nextCompleted = !t.is_completed;
  return updateTodo(t.id, {
    is_completed: nextCompleted,
    status: nextCompleted ? 'done' : 'todo',
  });
}
