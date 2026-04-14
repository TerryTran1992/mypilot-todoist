const TOKEN_KEY = 'mypilot_token';
const USER_KEY = 'mypilot_user';
const REFRESH_KEY = 'mypilot_refresh';

export type User = { id: string; email: string; name: string };

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getRefreshCookie(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setRefreshCookie(setCookieHeaders: string[]) {
  for (const line of setCookieHeaders) {
    const match = /(?:^|;\s*)(refreshToken=[^;]+)/.exec(line);
    if (match) {
      localStorage.setItem(REFRESH_KEY, match[1]);
      return;
    }
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
