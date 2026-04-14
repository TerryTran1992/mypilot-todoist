import { useEffect, useState } from 'react';

export function useLocalStore<T>(key: string, read: () => T): T {
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const onChange = () => setValue(read());
    window.addEventListener(`local:${key}`, onChange);
    return () => window.removeEventListener(`local:${key}`, onChange);
  }, [key, read]);
  return value;
}
