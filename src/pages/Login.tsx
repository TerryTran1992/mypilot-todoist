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
    <div className="h-full flex flex-col text-white bg-surface">
      <div className="drag h-11 shrink-0" />
      <div className="flex-1 flex items-center justify-center pb-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm p-8 bg-surface-raised rounded-2xl border border-zinc-800/60 shadow-xl"
        >
          <h1 className="font-heading text-4xl font-bold mb-1 text-accent">MyPilot</h1>
          <p className="text-zinc-400 text-sm mb-8 font-medium">Sign in to sync your tasks.</p>

          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 mb-4 bg-surface border border-zinc-800 rounded-lg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all duration-200"
          />

          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 mb-5 bg-surface border border-zinc-800 rounded-lg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all duration-200"
          />

          <label className="flex items-center gap-2.5 mb-6 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer rounded"
            />
            Stay signed in
          </label>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-50 text-black font-semibold rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-accent/20"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
