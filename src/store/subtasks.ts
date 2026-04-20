import { useEffect, useState } from 'react';
import api, { ApiError, NetworkError } from '../lib/api';
import { Todo } from '../types';
import { isTempId } from '../lib/sync';

const CACHE_KEY = 'mypilot_subtasks_cache';

function loadAllCache(): Record<string, Todo[]> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAllCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(allCache));
}

let allCache: Record<string, Todo[]> = loadAllCache();
const listeners = new Map<string, Set<(subs: Todo[]) => void>>();
const globalListeners = new Set<() => void>();

function notifyTodo(todoId: string) {
  const set = listeners.get(todoId);
  if (set) {
    const subs = allCache[todoId] ?? [];
    for (const l of set) l(subs);
  }
  for (const l of globalListeners) l();
}

function setSubtasksForTodo(todoId: string, subs: Todo[]) {
  if (subs.length === 0) {
    delete allCache[todoId];
  } else {
    allCache[todoId] = subs;
  }
  saveAllCache();
  notifyTodo(todoId);
}

function tempId() {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `temp_${rnd}`;
}

let localFallback = false;

async function fetchSubtasks(todoId: string): Promise<Todo[]> {
  if (localFallback) return allCache[todoId] ?? [];
  try {
    return await api.get<Todo[]>(`/todos/${todoId}/subtasks`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      localFallback = true;
      return allCache[todoId] ?? [];
    }
    if (err instanceof NetworkError) {
      return allCache[todoId] ?? [];
    }
    throw err;
  }
}

const fetched = new Set<string>();

export function useSubtasks(todoId: string) {
  const [subtasks, setSubtasks] = useState<Todo[]>(allCache[todoId] ?? []);
  const [loading, setLoading] = useState(!fetched.has(todoId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let set = listeners.get(todoId);
    if (!set) {
      set = new Set();
      listeners.set(todoId, set);
    }
    set.add(setSubtasks);
    return () => {
      set!.delete(setSubtasks);
      if (set!.size === 0) listeners.delete(todoId);
    };
  }, [todoId]);

  useEffect(() => {
    if (isTempId(todoId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSubtasks(todoId)
      .then((data) => {
        if (!cancelled) {
          fetched.add(todoId);
          setSubtasksForTodo(todoId, data);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load subtasks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [todoId]);

  return { subtasks, loading, error };
}

export function useSubtaskProgressListener() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((n) => n + 1);
    globalListeners.add(cb);
    return () => { globalListeners.delete(cb); };
  }, []);
}

export function getSubtaskProgress(todoId: string): { done: number; total: number } | null {
  const subs = allCache[todoId];
  if (!subs || subs.length === 0) return null;
  return { done: subs.filter((s) => s.is_completed).length, total: subs.length };
}

export async function createSubtask(todoId: string, data: { title: string } & Partial<Todo>): Promise<Todo> {
  const existing = allCache[todoId] ?? [];
  const optimistic: Todo = {
    id: tempId(),
    title: data.title,
    content: data.content ?? null,
    priority: data.priority ?? 'medium',
    is_completed: false,
    is_pinned: false,
    created_at: new Date().toISOString(),
    completed_at: null,
    energy_type: data.energy_type ?? null,
    category: data.category ?? null,
    estimated_minutes: data.estimated_minutes ?? null,
    actual_minutes: null,
    deadline: data.deadline ?? null,
    delegatable: data.delegatable ?? false,
    delegated_to: data.delegated_to ?? null,
    delegation_status: data.delegation_status ?? null,
    delegated_at: null,
    follow_up_days: null,
    parent_id: todoId,
  };
  setSubtasksForTodo(todoId, [...existing, optimistic]);

  if (localFallback) return optimistic;

  try {
    const created = await api.post<Todo>(`/todos/${todoId}/subtasks`, data);
    const current = allCache[todoId] ?? [];
    setSubtasksForTodo(todoId, current.map((s) => (s.id === optimistic.id ? created : s)));
    return created;
  } catch (err) {
    if (err instanceof NetworkError) return optimistic;
    const current = allCache[todoId] ?? [];
    setSubtasksForTodo(todoId, current.filter((s) => s.id !== optimistic.id));
    throw err;
  }
}

export async function updateSubtask(
  todoId: string,
  subId: string,
  patch: Partial<Todo>,
): Promise<Todo> {
  const existing = allCache[todoId] ?? [];
  const prev = existing.find((s) => s.id === subId);
  if (!prev) throw new Error('Subtask not found');
  setSubtasksForTodo(todoId, existing.map((s) => (s.id === subId ? { ...s, ...patch } : s)));

  if (localFallback || isTempId(subId)) {
    return { ...prev, ...patch };
  }

  try {
    const updated = await api.put<Todo>(`/todos/${subId}`, patch);
    const current = allCache[todoId] ?? [];
    setSubtasksForTodo(todoId, current.map((s) => (s.id === subId ? updated : s)));
    return updated;
  } catch (err) {
    if (err instanceof NetworkError) return { ...prev, ...patch };
    setSubtasksForTodo(todoId, existing);
    throw err;
  }
}

export async function deleteSubtask(todoId: string, subId: string): Promise<void> {
  const existing = allCache[todoId] ?? [];
  setSubtasksForTodo(todoId, existing.filter((s) => s.id !== subId));

  if (localFallback || isTempId(subId)) return;

  try {
    await api.delete(`/todos/${subId}`);
  } catch (err) {
    if (err instanceof NetworkError) return;
    setSubtasksForTodo(todoId, existing);
    throw err;
  }
}

export async function toggleSubtask(todoId: string, sub: Todo): Promise<Todo> {
  const nextCompleted = !sub.is_completed;
  return updateSubtask(todoId, sub.id, {
    is_completed: nextCompleted,
    completed_at: nextCompleted ? new Date().toISOString() : null,
  });
}

export async function reorderSubtasks(todoId: string, subtaskIds: string[]): Promise<void> {
  const existing = allCache[todoId] ?? [];
  const reordered = subtaskIds
    .map((id) => existing.find((sub) => sub.id === id))
    .filter((s): s is Todo => !!s);
  setSubtasksForTodo(todoId, reordered);

  if (localFallback) return;

  try {
    await api.put(`/todos/${todoId}/subtasks/reorder`, { subtask_ids: subtaskIds.filter((id) => !isTempId(id)) });
  } catch {
    // best-effort
  }
}

export function clearSubtasksForTodo(todoId: string) {
  delete allCache[todoId];
  saveAllCache();
  notifyTodo(todoId);
}

export function completeAllSubtasks(todoId: string) {
  const existing = allCache[todoId];
  if (!existing) return;
  const now = new Date().toISOString();
  setSubtasksForTodo(
    todoId,
    existing.map((s) =>
      s.is_completed ? s : { ...s, is_completed: true, completed_at: now },
    ),
  );
}
