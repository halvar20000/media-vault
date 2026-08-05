// Downloads and caches cover images locally so the app doesn't hot-link
// third-party hosts (more robust + private). Files are deduped by URL hash and
// served at /api/covers/<file>.
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

export const COVERS_DIR = config.coversDir || join(process.cwd(), 'data', 'covers');

// The URL path the frontend uses (proxied to the backend by nginx / vite).
export const COVERS_ROUTE = '/api/covers';

function ensureDir() {
  if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });
}

function extFor(url: string, contentType: string | null): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  const m = url.split('?')[0].match(/\.(png|webp|gif|jpe?g)$/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

// Download a remote cover into the cache. Returns the local served path, or
// null on failure (caller should then fall back to the remote URL).
export async function cacheCover(remoteUrl: string): Promise<string | null> {
  if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) return null;
  try {
    ensureDir();
    const hash = createHash('sha1').update(remoteUrl).digest('hex').slice(0, 24);

    // Dedup: if any cached file with this hash already exists, reuse it.
    for (const ext of ['.jpg', '.png', '.webp', '.gif']) {
      if (existsSync(join(COVERS_DIR, hash + ext))) return `${COVERS_ROUTE}/${hash}${ext}`;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(remoteUrl, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const ext = extFor(remoteUrl, res.headers.get('content-type'));
    writeFileSync(join(COVERS_DIR, hash + ext), buf);
    return `${COVERS_ROUTE}/${hash}${ext}`;
  } catch {
    return null;
  }
}
