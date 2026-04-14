import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import { getToken } from './lib/auth';

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken());

  useEffect(() => {
    const onLogout = () => setAuthed(false);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  return authed ? (
    <Home onLogout={() => setAuthed(false)} />
  ) : (
    <Login onLogin={() => setAuthed(true)} />
  );
}
