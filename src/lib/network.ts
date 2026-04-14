type Listener = (online: boolean) => void;

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(online);
}

export function isOnline() {
  return online;
}

export function setOnline(next: boolean) {
  if (online === next) return;
  online = next;
  notify();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}
