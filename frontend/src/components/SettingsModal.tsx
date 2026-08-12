import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { PRESETS } from '../marketplace';
import type { CustomShop, ShopsConfig } from '../types';

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'es', label: 'Español' },
];

export function SettingsModal({
  open,
  config,
  onClose,
  onSaved,
}: {
  open: boolean;
  config: ShopsConfig;
  onClose: () => void;
  onSaved: (cfg: ShopsConfig) => void;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [easycashStore, setEasycashStore] = useState('');
  const [custom, setCustom] = useState<CustomShop[]>([]);
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
      setCustom(config.custom ?? []);
      setNLabel(''); setNUrl(''); setNLang('en'); setErr(null);
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
      const saved = await api.saveShops({ enabled, easycashStore: easycashStore.trim(), custom });
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const easycashOn = enabled.includes('easycash');

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
