import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { User } from '../types';

export function Auth({ onAuthed }: { onAuthed: (u: User) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [allowRegistration, setAllowRegistration] = useState(false);

  useEffect(() => {
    api.authConfig().then((c) => setAllowRegistration(c.allowRegistration)).catch(() => {});
  }, []);
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
      setErr(e.message || t('auth.genericError'));
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
          {mode === 'login' ? t('auth.signInSub') : t('auth.registerSub')}
        </p>
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="dn">{t('auth.displayName')}</label>
              <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="em">{t('auth.email')}</label>
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
            <label htmlFor="pw">{t('auth.password')}</label>
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
            {busy ? '…' : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
          </button>
        </form>
        {allowRegistration && (
          <div className="toggle">
            {mode === 'login' ? (
              <>
                {t('auth.noAccount')}{' '}
                <button onClick={() => { setMode('register'); setErr(null); }}>{t('auth.register')}</button>
              </>
            ) : (
              <>
                {t('auth.haveAccount')}{' '}
                <button onClick={() => { setMode('login'); setErr(null); }}>{t('auth.signIn')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
