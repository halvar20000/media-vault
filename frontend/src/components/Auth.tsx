import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

export function Auth({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { user } =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, displayName || undefined);
      onAuthed(user);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brand">
          <h1>
            media-vault<span className="dot">.</span>
          </h1>
        </div>
        <p className="authsub">
          {mode === 'login' ? 'Sign in to your archive' : 'Create your local account'}
        </p>
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="dn">Display name (optional)</label>
              <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="em">Email</label>
            <input
              id="em"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
            />
          </div>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="toggle">
          {mode === 'login' ? (
            <>
              No account yet?{' '}
              <button onClick={() => { setMode('register'); setErr(null); }}>Register</button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button onClick={() => { setMode('login'); setErr(null); }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
