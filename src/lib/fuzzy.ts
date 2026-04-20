import { useRef, useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const DEFAULT_OPTIONS: IFuseOptions<any> = {
  threshold: 0.4,
  ignoreLocation: true,
};

function getNestedValue(obj: any, key: string): string {
  const parts = key.split('.');
  let val: any = obj;
  for (const p of parts) {
    if (val == null) return '';
    val = val[p];
  }
  return typeof val === 'string' ? val : '';
}

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
    const raw = search.trim();
    if (!raw) return items;

    const normalized = stripDiacritics(raw).toLowerCase();

    // Diacritics-normalized substring match (reliable for Vietnamese)
    const substringMatches = items.filter((item) =>
      keys.some((key) => {
        const val = getNestedValue(item, key);
        return stripDiacritics(val).toLowerCase().includes(normalized);
      }),
    );

    if (substringMatches.length > 0) return substringMatches;

    // Fallback to fuse.js fuzzy match for typo tolerance
    if (!fuseRef.current) return items;
    return fuseRef.current.search(raw).map((r) => r.item);
  }, [items, search, keys]);
}
