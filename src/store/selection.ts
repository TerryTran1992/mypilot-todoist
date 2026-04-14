import { useEffect, useState } from 'react';

let selected: string | null = null;
const listeners = new Set<(id: string | null) => void>();

export function openTask(id: string) {
  selected = id;
  for (const l of listeners) l(selected);
}

export function closeTask() {
  selected = null;
  for (const l of listeners) l(selected);
}

export function useSelectedId() {
  const [value, setValue] = useState<string | null>(selected);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
