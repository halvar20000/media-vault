// Resolves the session-signing secret. Users shouldn't have to think about this:
// if they don't set SESSION_SECRET, we generate one once and persist it in the
// data volume so logins survive restarts (a fresh secret each boot would log
// everyone out). Only a user-provided secret takes precedence.
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function resolveSessionSecret(envSecret: string, dataDir: string): string {
  const provided = (envSecret || '').trim();
  if (provided && provided !== 'dev-insecure-secret-change-me') return provided;

  const file = join(dataDir, '.session_secret');
  try {
    if (existsSync(file)) {
      const saved = readFileSync(file, 'utf8').trim();
      if (saved) return saved;
    }
    mkdirSync(dataDir, { recursive: true });
    const generated = randomBytes(48).toString('base64');
    writeFileSync(file, generated, { mode: 0o600 });
    console.log('[session] generated a session secret and saved it to the data volume');
    return generated;
  } catch (err) {
    // Couldn't persist (e.g. read-only FS): fall back to a per-process secret.
    // Sessions won't survive a restart, but the app still runs.
    console.warn('[session] could not persist a secret, using a temporary one:', (err as Error).message);
    return randomBytes(48).toString('base64');
  }
}
