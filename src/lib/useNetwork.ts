import { useEffect, useState } from 'react';
import { isOnline, subscribe } from './network';
import { loadQueue } from './sync';

export function useOnline() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => subscribe(setOnline), []);
  return online;
}

export function usePendingCount() {
  const [count, setCount] = useState(() => loadQueue().length);
  useEffect(() => {
    const update = () => setCount(loadQueue().length);
    window.addEventListener('queue:changed', update);
    return () => window.removeEventListener('queue:changed', update);
  }, []);
  return count;
}
