import { useRef, useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const DEFAULT_OPTIONS: IFuseOptions<any> = {
  threshold: 0.4,
  ignoreLocation: true,
  getFn: (obj: any, path: string | string[]) => {
    const keys = Array.isArray(path) ? path : path.split('.');
    let value: any = obj;
    for (const k of keys) {
      if (value == null) return '';
      value = value[k];
    }
    if (typeof value === 'string') return stripDiacritics(value);
    if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? stripDiacritics(v) : v));
    return value ?? '';
  },
};

export function useFuzzyFilter<T>(
  items: T[],
  search: string,
  keys: string[],
  options?: Partial<IFuseOptions<T>>,
): T[] {
  const fuseRef = useRef<Fuse<T>>();
  const itemsRef = useRef<T[]>([]);

  if (items !== itemsRef.current) {
    itemsRef.current = items;
    fuseRef.current = new Fuse(items, { ...DEFAULT_OPTIONS, keys, ...options });
  }

  return useMemo(() => {
    const q = stripDiacritics(search.trim());
    if (!q) return items;
    if (!fuseRef.current) return items;
    return fuseRef.current.search(q).map((r) => r.item);
  }, [items, search]);
}
