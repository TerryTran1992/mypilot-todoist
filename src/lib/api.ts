import { clearAuth, getToken } from './auth';

type ApiResponse<T> = { status: number; ok: boolean; data: T };

declare global {
  interface Window {
    api: {
      request: <T = unknown>(args: {
        method: string;
        path: string;
        body?: unknown;
        token?: string | null;
      }) => Promise<ApiResponse<T>>;
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

type ServerEnvelope<T> = { success?: boolean; data?: T; message?: string; error?: string };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await window.api.request<ServerEnvelope<T> | T>({ method, path, body, token });

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (!res.ok) {
    const env = res.data as ServerEnvelope<T>;
    throw new ApiError(res.status, env?.message || env?.error || `Request failed (${res.status})`);
  }

  const env = res.data as ServerEnvelope<T>;
  return (env?.data ?? (res.data as T)) as T;
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export default api;
