import { useState, FormEvent } from 'react';
import api, { ApiError } from '../lib/api';
import { setAuth, setRefreshCookie, User } from '../lib/auth';

type LoginResponse = { user: User; accessToken: string };

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, setCookie } = await api.postLogin<LoginResponse>('/auth/login', {
        email,
        password,
        rememberMe: remember,
      });
      setAuth(data.accessToken, data.user);
      if (setCookie.length) setRefreshCookie(setCookie);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col text-white">
      <div className="drag h-10 shrink-0" />
      <div className="flex-1 flex items-center justify-center pb-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm p-8 bg-zinc-900 rounded-2xl border border-zinc-800"
        >
          <h1 className="text-3xl font-semibold mb-1">MyPilot Todoist</h1>
          <p className="text-zinc-400 text-sm mb-6">Sign in to sync your tasks.</p>

          <label className="block text-xs text-zinc-400 mb-1">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 mb-4 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-accent focus:outline-none"
          />

          <label className="block text-xs text-zinc-400 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 mb-4 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-accent focus:outline-none"
          />

          <label className="flex items-center gap-2 mb-4 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            Stay signed in
          </label>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-black font-medium rounded-lg cursor-pointer transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
