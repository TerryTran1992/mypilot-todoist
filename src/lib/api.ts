import {
  clearAuth,
  getRefreshCookie,
  getToken,
  setAccessToken,
  setRefreshCookie,
} from './auth';
import { setOnline } from './network';

type ApiResponse<T> = { status: number; ok: boolean; data: T; setCookie: string[] };

declare global {
  interface Window {
    api: {
      request: <T = unknown>(args: {
        method: string;
        path: string;
        body?: unknown;
        token?: string | null;
        cookie?: string | null;
      }) => Promise<ApiResponse<T>>;
      hideQuickAdd: () => void;
      notifyTodoCreated: () => void;
      onTodosRefresh: (callback: () => void) => () => void;
      platform: string;
    };
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

type ServerEnvelope<T> = { success?: boolean; data?: T; message?: string; error?: string };

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const cookie = getRefreshCookie();
  if (!cookie) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await window.api.request<ServerEnvelope<{ accessToken: string }>>({
        method: 'POST',
        path: '/auth/refresh',
        cookie,
      });
      if (!res.ok) return false;
      const env = res.data as ServerEnvelope<{ accessToken: string }>;
      const newToken = env?.data?.accessToken;
      if (!newToken) return false;
      setAccessToken(newToken);
      if (res.setCookie?.length) setRefreshCookie(res.setCookie);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function rawRequest<T>(method: string, path: string, body: unknown | undefined) {
  const token = getToken();
  return window.api.request<ServerEnvelope<T> | T>({ method, path, body, token });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await rawRequest<T>(method, path, body);

  if (res.status === 0) {
    setOnline(false);
    const env = res.data as ServerEnvelope<T>;
    throw new NetworkError(env?.message || 'Network unavailable');
  }
  setOnline(true);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest<T>(method, path, body);
      if (res.status === 0) {
        setOnline(false);
        throw new NetworkError('Network unavailable');
      }
    } else {
      clearAuth();
      window.dispatchEvent(new Event('auth:logout'));
    }
  }

  if (!res.ok) {
    const env = res.data as ServerEnvelope<T>;
    throw new ApiError(res.status, env?.message || env?.error || `Request failed (${res.status})`);
  }

  const env = res.data as ServerEnvelope<T>;
  return (env?.data ?? (res.data as T)) as T;
}

async function postLogin<T>(path: string, body: unknown): Promise<{ data: T; setCookie: string[] }> {
  const res = await window.api.request<ServerEnvelope<T>>({ method: 'POST', path, body });
  if (!res.ok) {
    const env = res.data as ServerEnvelope<T>;
    throw new ApiError(res.status, env?.message || env?.error || 'Login failed');
  }
  const env = res.data as ServerEnvelope<T>;
  return { data: (env?.data ?? (res.data as T)) as T, setCookie: res.setCookie ?? [] };
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postLogin,
};

export default api;
