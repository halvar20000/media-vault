import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';

export const settingsRouter = Router();

// Shape of the shops configuration stored under settings key 'shops'.
interface CustomShop {
  id: string;
  label: string;
  url: string; // search-URL template containing {query}
  lang: string; // fr | de | en | nl | es (drives bundle phrasing)
}
interface ShopsConfig {
  enabled: string[]; // built-in preset ids
  easycashStore: string;
  craigslistSite: string;
  custom: CustomShop[];
}

const LANGS = ['fr', 'de', 'en', 'nl', 'es'];

// Defaults come from the environment so an existing env-configured instance keeps
// working until someone saves settings in the UI.
function envDefaults(): ShopsConfig {
  return {
    enabled: config.marketplaces,
    easycashStore: config.easycashStore,
    craigslistSite: config.craigslistSite,
    custom: [],
  };
}

function sanitize(body: any): ShopsConfig {
  const enabled = Array.isArray(body?.enabled)
    ? body.enabled.filter((s: unknown) => typeof s === 'string').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const easycashStore = typeof body?.easycashStore === 'string' ? body.easycashStore.trim() : '';
  // Craigslist subdomain only — letters/digits/hyphen (e.g. "newyork", "sfbay").
  const craigslistSite =
    typeof body?.craigslistSite === 'string'
      ? body.craigslistSite.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      : '';

  const seen = new Set<string>();
  const custom: CustomShop[] = [];
  for (const c of Array.isArray(body?.custom) ? body.custom : []) {
    const label = String(c?.label ?? '').trim();
    const url = String(c?.url ?? '').trim();
    const lang = LANGS.includes(String(c?.lang)) ? String(c.lang) : 'en';
    if (!label || !url) continue;
    // Must be an http(s) template with a {query} placeholder (no javascript: etc.).
    if (!/^https?:\/\//i.test(url) || !url.includes('{query}')) {
      throw new Error(`custom shop "${label}" needs an http(s) URL containing {query}`);
    }
    let id = String(c?.id ?? '').trim() || 'c-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    while (seen.has(id)) id += '-x';
    seen.add(id);
    custom.push({ id, label, url, lang });
  }
  return { enabled, easycashStore, craigslistSite, custom };
}

// GET /api/settings/shops → effective shops config (DB row, else env defaults).
settingsRouter.get('/shops', requireAuth, async (_req, res) => {
  const rows = await query<{ value: ShopsConfig }>(`SELECT value FROM settings WHERE key = 'shops'`);
  res.json(rows.length ? rows[0].value : envDefaults());
});

// PUT /api/settings/shops → save the shops config (any signed-in user).
settingsRouter.put('/shops', requireAuth, async (req, res) => {
  let clean: ShopsConfig;
  try {
    clean = sanitize(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? 'invalid settings' });
  }
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('shops', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(clean)]
  );
  res.json(clean);
});
