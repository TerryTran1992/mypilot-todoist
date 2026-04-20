import { useRef, useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

const DEFAULT_OPTIONS: IFuseOptions<any> = {
  threshold: 0.4,
  ignoreLocation: true,
};

export function useFuzzyFilter<T>(
  items: T[],
  search: string,
  keys: string[],
  options?: Partial<IFuseOptions<T>>,
): T[] {
  const fuseRef = useRef<Fuse<T>>();
  const countRef = useRef(0);

  if (items.length !== countRef.current) {
    countRef.current = items.length;
    fuseRef.current = new Fuse(items, { ...DEFAULT_OPTIONS, keys, ...options });
  }

  return useMemo(() => {
    const q = search.trim();
    if (!q) return items;
    if (!fuseRef.current) return items;
    return fuseRef.current.search(q).map((r) => r.item);
  }, [items, search]);
}
