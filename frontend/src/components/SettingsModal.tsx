import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { PRESETS } from '../marketplace';
import type { CustomShop, KeysStatus, ShopsConfig } from '../types';

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'es', label: 'Español' },
];

// Secret API-key fields, grouped by what they unlock. The UI only ever shows
// whether each is configured, never the value.
const SECRET_KEYS: { f: keyof KeysStatus; label: string; group: string }[] = [
  { f: 'igdbClientId', label: 'IGDB Client ID', group: 'Games — IGDB (unlocks covers + catalogue)' },
  { f: 'igdbClientSecret', label: 'IGDB Client Secret', group: 'Games — IGDB (unlocks covers + catalogue)' },
  { f: 'tmdbAccessToken', label: 'TMDB Read Access Token (v4)', group: 'Movies — TMDB' },
  { f: 'discogsToken', label: 'Discogs token', group: 'Music — Discogs' },
  { f: 'discogsKey', label: 'Discogs consumer key', group: 'Music — Discogs' },
  { f: 'discogsSecret', label: 'Discogs consumer secret', group: 'Music — Discogs' },
  { f: 'ebayClientId', label: 'eBay Client ID (App ID)', group: 'Game valuation — eBay (free)' },
  { f: 'ebayClientSecret', label: 'eBay Client Secret (Cert ID)', group: 'Game valuation — eBay (free)' },
  { f: 'pricechartingToken', label: 'PriceCharting token (paid, optional)', group: 'Game valuation — eBay (free)' },
  { f: 'steamApiKey', label: 'Steam Web API key', group: 'Steam import (add your digital games)' },
];
const PLAIN_KEYS: { f: keyof KeysStatus; label: string; ph: string }[] = [
  { f: 'tmdbLanguage', label: 'TMDB language', ph: 'en-US' },
  { f: 'ebayMarketplaceId', label: 'eBay marketplace', ph: 'EBAY_DE' },
  { f: 'valuationCurrency', label: 'Discogs value currency', ph: 'EUR' },
];

export function SettingsModal({
  open,
  config,
  onClose,
  onSaved,
  onKeysSaved,
}: {
  open: boolean;
  config: ShopsConfig;
  onClose: () => void;
  onSaved: (cfg: ShopsConfig) => void;
  onKeysSaved: () => void;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [easycashStore, setEasycashStore] = useState('');
  const [craigslistSite, setCraigslistSite] = useState('');
  const [custom, setCustom] = useState<CustomShop[]>([]);
  const [keys, setKeys] = useState<KeysStatus | null>(null);
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [plainInputs, setPlainInputs] = useState<Record<string, string>>({});
  const [nLabel, setNLabel] = useState('');
  const [nUrl, setNUrl] = useState('');
  const [nLang, setNLang] = useState('en');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset the form to the saved config whenever the modal opens.
  useEffect(() => {
    if (open) {
      setEnabled(config.enabled ?? []);
      setEasycashStore(config.easycashStore ?? '');
      setCraigslistSite(config.craigslistSite ?? '');
      setCustom(config.custom ?? []);
      setNLabel(''); setNUrl(''); setNLang('en'); setErr(null);
      // Load masked API-keys status fresh each open.
      api.getKeys().then((k) => {
        setKeys(k);
        setSecretInputs({});
        setPlainInputs({
          tmdbLanguage: k.tmdbLanguage || '',
          ebayMarketplaceId: k.ebayMarketplaceId || '',
          valuationCurrency: k.valuationCurrency || '',
        });
      }).catch(() => {});
    }
  }, [open, config]);

  if (!open) return null;

  const toggle = (id: string) =>
    setEnabled((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  function addCustom() {
    setErr(null);
    const label = nLabel.trim();
    const url = nUrl.trim();
    if (!label || !url) return;
    if (!/^https?:\/\//i.test(url) || !url.includes('{query}')) {
      setErr(t('settings.customError'));
      return;
    }
    const id = 'c-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + custom.length;
    setCustom((c) => [...c, { id, label, url, lang: nLang }]);
    setNLabel(''); setNUrl(''); setNLang('en');
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const saved = await api.saveShops({ enabled, easycashStore: easycashStore.trim(), craigslistSite: craigslistSite.trim(), custom });
      // Build the API-keys patch: changed secrets (non-empty) + all plain fields.
      const patch: Record<string, string> = {};
      for (const s of SECRET_KEYS) {
        const v = (secretInputs[s.f] || '').trim();
        if (v) patch[s.f] = v;
      }
      for (const p of PLAIN_KEYS) patch[p.f] = (plainInputs[p.f] ?? '').trim();
      await api.saveKeys(patch);
      onSaved(saved);
      onKeysSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const easycashOn = enabled.includes('easycash');
  const craigslistOn = enabled.includes('craigslist');

  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="mtop">
          <h3>{t('settings.title')}</h3>
          <button className="close" style={{ position: 'static' }} onClick={onClose}>✕</button>
        </div>

        <div className="mbody">
          <p className="setintro">{t('settings.intro')}</p>

          <div className="setgroup">
            {PRESETS.map((p) => (
              <label key={p.id} className="setrow">
                <input type="checkbox" checked={enabled.includes(p.id)} onChange={() => toggle(p.id)} />
                <span className="setlabel">{p.label}</span>
                <span className="setcountry">{p.country}</span>
              </label>
            ))}
          </div>

          {easycashOn && (
            <div className="setfield">
              <label>{t('settings.easycashStore')}</label>
              <input
                value={easycashStore}
                onChange={(e) => setEasycashStore(e.target.value)}
                placeholder="68 - Mulhouse"
              />
              <span className="sethint">{t('settings.easycashHint')}</span>
            </div>
          )}

          {craigslistOn && (
            <div className="setfield">
              <label>{t('settings.craigslistSite')}</label>
              <input
                value={craigslistSite}
                onChange={(e) => setCraigslistSite(e.target.value)}
                placeholder="newyork"
              />
              <span className="sethint">{t('settings.craigslistHint')}</span>
            </div>
          )}

          <h4 className="seth4">{t('settings.customTitle')}</h4>
          {custom.length > 0 && (
            <div className="setgroup">
              {custom.map((c) => (
                <div key={c.id} className="setrow">
                  <span className="setlabel">{c.label}</span>
                  <span className="setcountry" style={{ textTransform: 'uppercase' }}>{c.lang}</span>
                  <button className="setdel" onClick={() => setCustom((cs) => cs.filter((x) => x.id !== c.id))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="setcustomadd">
            <input placeholder={t('settings.customName')} value={nLabel} onChange={(e) => setNLabel(e.target.value)} />
            <input placeholder="https://shop.xy/search?q={query}" value={nUrl} onChange={(e) => setNUrl(e.target.value)} />
            <div className="setcustomrow">
              <select value={nLang} onChange={(e) => setNLang(e.target.value)} aria-label="language">
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button className="ghostbtn" onClick={addCustom} disabled={!nLabel.trim() || !nUrl.trim()}>＋ {t('settings.customAdd')}</button>
            </div>
            <span className="sethint">{t('settings.customHint')}</span>
          </div>

          <h4 className="seth4">{t('settings.keysTitle')}</h4>
          <p className="sethint" style={{ marginBottom: 12 }}>{t('settings.keysHint')}</p>
          {SECRET_KEYS.map((s, i) => (
            <div key={s.f}>
              {(i === 0 || SECRET_KEYS[i - 1].group !== s.group) && (
                <div className="setkeygroup">{s.group}</div>
              )}
              <div className="setfield">
                <label>
                  {s.label}
                  {keys && (keys[s.f] ? <span className="setok"> ✓ configured</span> : <span className="setmuted"> — not set</span>)}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={secretInputs[s.f] || ''}
                  onChange={(e) => setSecretInputs((v) => ({ ...v, [s.f]: e.target.value }))}
                  placeholder={keys && keys[s.f] ? '•••••••• (leave blank to keep)' : t('settings.keysPlaceholder')}
                />
              </div>
            </div>
          ))}
          <div className="setkeygroup">{t('settings.keysOptions')}</div>
          {PLAIN_KEYS.map((p) => (
            <div key={p.f} className="setfield">
              <label>{p.label}</label>
              <input
                value={plainInputs[p.f] ?? ''}
                onChange={(e) => setPlainInputs((v) => ({ ...v, [p.f]: e.target.value }))}
                placeholder={p.ph}
              />
            </div>
          ))}

          {err && <p className="seterr">{err}</p>}
        </div>

        <div className="mnote" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="ghostbtn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="addbtn" onClick={save} disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}
