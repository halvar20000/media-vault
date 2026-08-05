import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '../api';
import { TYPE_ORDER } from '../types';
import type { MediaType, SearchHit } from '../types';

type Method = 'search' | 'import' | 'scan';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  sources: { igdb: boolean; tmdb: boolean; discogs: boolean };
}

function sourceForType(t: MediaType): 'igdb' | 'tmdb' | 'discogs' {
  if (t === 'game') return 'igdb';
  if (t === 'movie') return 'tmdb';
  return 'discogs';
}

export function AddModal({ open, onClose, onAdded, sources }: Props) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<Method>('search');
  const [type, setType] = useState<MediaType>('game');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<'games' | 'movies'>('games');
  const fileRef = useRef<HTMLInputElement>(null);

  const sourceOn = sources[sourceForType(type)];

  useEffect(() => {
    if (!open) {
      setHits([]);
      setQ('');
      setMsg(null);
      setMethod('search');
    }
  }, [open]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { hits } = await api.search(type, q.trim());
      setHits(hits);
      if (!hits.length) setMsg(t('add.noMatches'));
    } catch (e: any) {
      setMsg(e.message || 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function addHit(h: SearchHit) {
    setBusy(true);
    try {
      await api.createItem({
        type,
        title: h.title,
        year: h.year ?? undefined,
        format: h.format ?? undefined,
        cover_url: h.coverUrl ?? undefined,
        rating: h.rating ?? undefined,
        description: h.description ?? undefined,
        source: h.source,
        source_id: h.sourceId,
      });
      setMsg(`Added “${h.title}”.`);
      onAdded();
    } catch (e: any) {
      setMsg(e.message || 'Could not add item');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.importCsv(importKind, file);
      setMsg(t('add.imported', { count: r.imported, kind: t(`types_plural.${importKind === 'movies' ? 'movie' : 'game'}`) }));
      onAdded();
    } catch (e: any) {
      setMsg(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="mtop">
          <h3>{t('add.title')}</h3>
          <button className="close" style={{ position: 'static' }} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="methods">
          <button className="method" aria-pressed={method === 'search'} onClick={() => setMethod('search')}>
            <span className="mi">⌨︎</span>
            <span className="mh">{t('add.searchTitle')}</span>
            <span className="md">{t('add.searchDesc')}</span>
          </button>
          <button className="method" aria-pressed={method === 'import'} onClick={() => setMethod('import')}>
            <span className="mi">⇪</span>
            <span className="mh">{t('add.bulkImport')}</span>
            <span className="md">{t('add.bulkDesc')}</span>
          </button>
          <button className="method" aria-pressed={method === 'scan'} onClick={() => setMethod('scan')}>
            <span className="mi">📷</span>
            <span className="mh">{t('add.scan')}</span>
            <span className="md">{t('add.scanDesc')}</span>
          </button>
        </div>

        <div className="mbody">
          {method === 'search' && (
            <>
              <div className="rowfields">
                <div className="field">
                  <label>{t('add.mediaType')}</label>
                  <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                    {TYPE_ORDER.map((mt) => (
                      <option key={mt} value={mt}>
                        {t(`types.${mt}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <form className="field" style={{ flex: 2 }} onSubmit={runSearch}>
                  <label>{t('add.titleLabel')}</label>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('add.titlePlaceholder')} autoFocus />
                </form>
              </div>
              {!sourceOn && (
                <p className="mnote" style={{ padding: 0, border: 0 }}>
                  <b>{sourceForType(type).toUpperCase()}</b> {t('add.sourceMissing', { type: t(`types.${type}`) })}
                </p>
              )}
              <button className="primary" onClick={runSearch} disabled={busy || !sourceOn}>
                {busy ? t('common.searching') : t('common.search')}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              <div className="hits">
                {hits.map((h) => (
                  <button className="hit" key={h.source + h.sourceId} onClick={() => addHit(h)} disabled={busy}>
                    {h.coverUrl ? <img src={h.coverUrl} alt="" /> : <span className="noart" />}
                    <span className="hinfo">
                      <b>{h.title}</b>
                      <span>
                        {[h.year, h.format, h.rating !== null ? `★ ${Math.round(h.rating)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {method === 'import' && (
            <>
              <div className="rowfields">
                <div className="field">
                  <label>{t('add.importType')}</label>
                  <select value={importKind} onChange={(e) => setImportKind(e.target.value as 'games' | 'movies')}>
                    <option value="games">{t('add.gamesList')}</option>
                    <option value="movies">{t('add.moviesList')}</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>{t('add.csvFile')}</label>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" />
                </div>
              </div>
              <button className="primary" onClick={doImport} disabled={busy}>
                {busy ? t('add.importing') : t('add.import', { kind: t(`types_plural.${importKind === 'movies' ? 'movie' : 'game'}`) })}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              <p className="mnote">
                {importKind === 'games' ? t('add.gamesNote') : t('add.moviesNote')}{' '}
                {t('add.afterImport')}
              </p>
            </>
          )}

          {method === 'scan' && <BarcodeScan onCode={(code) => { setMethod('search'); setType('cd'); setQ(code); }} />}
        </div>

        <p className="mnote">{t('add.sourcesNote')}</p>
      </div>
    </div>
  );
}

// Cross-platform barcode scanning via ZXing (works on iOS Safari too, unlike
// the native BarcodeDetector API).
function BarcodeScan({ onCode }: { onCode: (code: string) => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        if (!videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            onCode(result.getText());
            controls?.stop();
          }
        });
      } catch (e: any) {
        setError(e?.message || t('add.scanUnavailable'));
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onCode]);

  return (
    <div>
      <video ref={videoRef} style={{ width: '100%', borderRadius: 6, background: '#000' }} muted playsInline />
      {error && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{error}</p>}
      <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{t('add.scanHint')}</p>
    </div>
  );
}
