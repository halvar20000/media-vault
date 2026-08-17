import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '../api';
import { TYPE_ORDER } from '../types';
import { CONSOLES } from '../consoles';
import type { MediaType, SearchHit } from '../types';

type Method = 'search' | 'import' | 'scan' | 'manual' | 'check' | 'steam' | 'console';

interface CheckResult {
  input: string;
  status: 'owned' | 'wishlist' | 'new';
  match: string | null;
}

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
  const [barcode, setBarcode] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [autoAdd, setAutoAdd] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  const [resolved, setResolved] = useState('');
  const [manual, setManual] = useState({ title: '', format: '', year: '', barcode: '', condition: '', notes: '' });
  const [steamId, setSteamId] = useState('');
  const [ownedConsoles, setOwnedConsoles] = useState<Set<string>>(new Set());
  const [busyConsole, setBusyConsole] = useState<string | null>(null);
  const [checkText, setCheckText] = useState('');
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [checkSummary, setCheckSummary] = useState<{ total: number; owned: number; wishlist: number; new: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const sourceOn = sources[sourceForType(type)];

  useEffect(() => {
    if (!open) {
      setHits([]);
      setQ('');
      setBarcode('');
      setShowCamera(false);
      setAutoAdd(false);
      setWishlist(false);
      setResolved('');
      setManual({ title: '', format: '', year: '', barcode: '', condition: '', notes: '' });
      setCheckText('');
      setCheckResults([]);
      setCheckSummary(null);
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

  async function lookupBarcode(codeArg?: string) {
    const code = (codeArg ?? barcode).replace(/\D/g, '');
    if (!code) return;
    setBusy(true);
    setMsg(null);
    let found = false;
    try {
      const { hits, resolvedTitle } = await api.barcodeLookup(type, code);
      setHits(hits);
      found = hits.length > 0;
      setResolved(resolvedTitle || '');
      if (found && autoAdd) {
        await addHit(hits[0]);
      } else if (!found) {
        setMsg(resolvedTitle ? t('add.barcodeResolvedNoMatch', { title: resolvedTitle }) : t('add.barcodeNoProduct'));
      }
    } catch (e: any) {
      setMsg(e.message || 'Lookup failed');
    } finally {
      setBusy(false);
      // Clear + refocus so a USB scanner is immediately ready for the next item.
      if (found) setBarcode('');
      barcodeRef.current?.focus();
    }
  }

  // Shared create with duplicate-confirm handling.
  async function submitItem(data: Record<string, unknown>, successTitle: string): Promise<boolean> {
    try {
      await api.createItem(data);
      setMsg(t('add.added', { title: successTitle }));
      onAdded();
      return true;
    } catch (e: any) {
      if (e.duplicate) {
        const ex = e.duplicate;
        const fmt = ex.format ? ` (${ex.format})` : '';
        if (window.confirm(t('add.duplicateConfirm', { title: ex.title, fmt }))) {
          try {
            await api.createItem(data, true);
            setMsg(t('add.added', { title: successTitle }));
            onAdded();
            return true;
          } catch (e2: any) {
            setMsg(e2.message || 'Could not add item');
          }
        } else {
          setMsg(t('add.duplicateSkipped'));
        }
      } else {
        setMsg(e.message || 'Could not add item');
      }
      return false;
    }
  }

  async function addHit(h: SearchHit) {
    setBusy(true);
    try {
      await submitItem(
        {
          type,
          title: h.title,
          year: h.year ?? undefined,
          format: h.format ?? undefined,
          cover_url: h.coverUrl ?? undefined,
          rating: h.rating ?? undefined,
          description: h.description ?? undefined,
          source: h.source,
          source_id: h.sourceId,
          barcode: method === 'scan' && barcode ? barcode.replace(/\D/g, '') : undefined,
          wishlist: wishlist || undefined,
        },
        h.title
      );
    } finally {
      setBusy(false);
    }
  }

  async function createManual() {
    const title = manual.title.trim();
    if (!title) return;
    setBusy(true);
    setMsg(null);
    try {
      const ok = await submitItem(
        {
          type,
          title,
          format: manual.format.trim() || undefined,
          year: manual.year ? parseInt(manual.year, 10) : undefined,
          barcode: manual.barcode.replace(/\D/g, '') || undefined,
          condition: manual.condition.trim() || undefined,
          notes: manual.notes.trim() || undefined,
          wishlist: wishlist || undefined,
        },
        title
      );
      if (ok) setManual({ title: '', format: '', year: '', barcode: '', condition: '', notes: '' });
    } finally {
      setBusy(false);
    }
  }

  async function runCheck() {
    if (!checkText.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { results, summary } = await api.checkBundle(checkText, type);
      setCheckResults(results);
      setCheckSummary(summary);
    } catch (e: any) {
      setMsg(e.message || 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  // Load which consoles are already owned when the Console picker opens.
  useEffect(() => {
    if (method !== 'console') return;
    api.listItems({ type: 'console' })
      .then(({ items }) => setOwnedConsoles(new Set(items.map((i) => i.title))))
      .catch(() => {});
  }, [method]);

  async function addConsole(name: string, image: string) {
    setBusyConsole(name);
    try {
      await api.createItem({ type: 'console', title: name, cover_url: image, cover_source_url: image }, true);
      setOwnedConsoles((s) => new Set(s).add(name));
      onAdded();
    } catch {
      /* ignore */
    } finally {
      setBusyConsole(null);
    }
  }

  async function runSteamImport() {
    if (!steamId.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.importSteam(steamId.trim());
      setMsg(
        r.hint
          ? r.hint
          : t('add.steamDone', { imported: r.imported, skipped: r.skipped })
      );
      if (r.imported > 0) onAdded();
    } catch (e: any) {
      setMsg(e.message || 'Steam import failed');
    } finally {
      setBusy(false);
    }
  }

  async function addAllNewToWishlist() {
    const news = checkResults.filter((r) => r.status === 'new');
    if (!news.length) return;
    setBusy(true);
    try {
      for (const r of news) {
        try {
          await api.createItem({ type, title: r.input, wishlist: true }, true);
        } catch {
          /* skip individual failures */
        }
      }
      // mark them as wishlist in the visible results
      setCheckResults((rs) => rs.map((r) => (r.status === 'new' ? { ...r, status: 'wishlist', match: r.input } : r)));
      setCheckSummary((s) => (s ? { ...s, wishlist: s.wishlist + news.length, new: 0 } : s));
      setMsg(t('add.addedNToWishlist', { count: news.length }));
      onAdded();
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
          <button className="method" aria-pressed={method === 'manual'} onClick={() => setMethod('manual')}>
            <span className="mi">✎</span>
            <span className="mh">{t('add.manual')}</span>
            <span className="md">{t('add.manualDesc')}</span>
          </button>
          <button className="method" aria-pressed={method === 'check'} onClick={() => setMethod('check')}>
            <span className="mi">✓</span>
            <span className="mh">{t('add.check')}</span>
            <span className="md">{t('add.checkDesc')}</span>
          </button>
          <button className="method" aria-pressed={method === 'steam'} onClick={() => setMethod('steam')}>
            <span className="mi">🎮</span>
            <span className="mh">{t('add.steam')}</span>
            <span className="md">{t('add.steamDesc')}</span>
          </button>
          <button className="method" aria-pressed={method === 'console'} onClick={() => setMethod('console')}>
            <span className="mi">🕹️</span>
            <span className="mh">{t('add.console')}</span>
            <span className="md">{t('add.consoleDesc')}</span>
          </button>
        </div>

        <div className="mbody">
          {(method === 'search' || method === 'scan' || method === 'manual') && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              <input type="checkbox" checked={wishlist} onChange={(e) => setWishlist(e.target.checked)} style={{ width: 'auto' }} />
              ★ {t('wishlist.add')}
            </label>
          )}
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

          {method === 'scan' && (
            <>
              <div className="rowfields">
                <div className="field">
                  <label>{t('add.mediaType')}</label>
                  <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                    {TYPE_ORDER.map((mt) => (
                      <option key={mt} value={mt}>{t(`types.${mt}`)}</option>
                    ))}
                  </select>
                </div>
                <form className="field" style={{ flex: 2 }} onSubmit={(e) => { e.preventDefault(); lookupBarcode(); }}>
                  <label>{t('add.barcode')}</label>
                  <input
                    ref={barcodeRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    inputMode="numeric"
                    placeholder="0888837168618"
                    autoFocus
                  />
                </form>
              </div>
              <p className="mnote" style={{ padding: 0, border: 0, marginTop: 4 }}>{t('add.usbHint')}</p>
              <div className="rowfields" style={{ alignItems: 'center', marginTop: 8 }}>
                <button className="primary" onClick={() => lookupBarcode()} disabled={busy || !sourceOn}>
                  {busy ? t('common.searching') : t('add.lookup')}
                </button>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>
                  <input type="checkbox" checked={autoAdd} onChange={(e) => setAutoAdd(e.target.checked)} style={{ width: 'auto' }} />
                  {t('add.autoAdd')}
                </label>
              </div>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              {msg && hits.length === 0 && !busy && (
                <button
                  className="ghostbtn"
                  style={{ marginTop: 8 }}
                  onClick={() => { setMethod('search'); setMsg(null); if (resolved) setQ(resolved); }}
                >
                  → {t('add.searchInstead')}
                </button>
              )}
              <div className="hits">
                {hits.map((h) => (
                  <button className="hit" key={h.source + h.sourceId} onClick={() => addHit(h)} disabled={busy}>
                    {h.coverUrl ? <img src={h.coverUrl} alt="" /> : <span className="noart" />}
                    <span className="hinfo">
                      <b>{h.title}</b>
                      <span>{[h.year, h.format, h.rating !== null ? `★ ${Math.round(h.rating)}` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                ))}
              </div>
              {showCamera ? (
                <BarcodeScan onCode={(code) => { setShowCamera(false); setBarcode(code); lookupBarcode(code); }} />
              ) : (
                <button className="ghostbtn" style={{ marginTop: 12 }} onClick={() => setShowCamera(true)}>
                  📷 {t('add.scanWithCamera')}
                </button>
              )}
            </>
          )}

          {method === 'manual' && (
            <form onSubmit={(e) => { e.preventDefault(); createManual(); }}>
              <div className="rowfields">
                <div className="field">
                  <label>{t('add.mediaType')}</label>
                  <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                    {TYPE_ORDER.map((mt) => <option key={mt} value={mt}>{t(`types.${mt}`)}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>{t('add.titleLabel')} *</label>
                  <input value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} autoFocus />
                </div>
              </div>
              <div className="rowfields">
                <div className="field">
                  <label>{t('drawer.format')}</label>
                  <input value={manual.format} onChange={(e) => setManual({ ...manual, format: e.target.value })} placeholder="Xbox / Xbox 360 / Blu-Ray…" />
                </div>
                <div className="field">
                  <label>{t('drawer.year')}</label>
                  <input type="number" value={manual.year} onChange={(e) => setManual({ ...manual, year: e.target.value })} />
                </div>
              </div>
              <div className="rowfields">
                <div className="field" style={{ flex: 2 }}>
                  <label>{t('add.barcode')}</label>
                  <input value={manual.barcode} inputMode="numeric" onChange={(e) => setManual({ ...manual, barcode: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t('drawer.condition')}</label>
                  <input value={manual.condition} onChange={(e) => setManual({ ...manual, condition: e.target.value })} placeholder="loose / CIB / VG+…" />
                </div>
              </div>
              <div className="field">
                <label>{t('drawer.notes')}</label>
                <textarea rows={2} value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} />
              </div>
              <button className="primary" type="submit" disabled={busy || !manual.title.trim()}>
                {busy ? '…' : t('add.addManually')}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{t('add.manualNote')}</p>
            </form>
          )}
          {method === 'check' && (
            <>
              <div className="rowfields">
                <div className="field">
                  <label>{t('add.mediaType')}</label>
                  <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                    {TYPE_ORDER.map((mt) => <option key={mt} value={mt}>{t(`types.${mt}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>{t('add.checkLabel')}</label>
                <textarea rows={6} value={checkText} onChange={(e) => setCheckText(e.target.value)} placeholder={t('add.checkPlaceholder')} autoFocus />
              </div>
              <button className="primary" onClick={runCheck} disabled={busy || !checkText.trim()}>
                {busy ? '…' : t('add.checkBtn')}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              {checkSummary && (
                <>
                  <p className="mnote" style={{ padding: '12px 0 6px', border: 0, color: 'var(--surface)' }}>
                    <b style={{ color: 'var(--t-game)' }}>{checkSummary.owned} {t('add.chkOwned')}</b>
                    {checkSummary.wishlist > 0 && <> · <b style={{ color: 'var(--accent)' }}>{checkSummary.wishlist} ★</b></>}
                    {' · '}<b>{checkSummary.new} {t('add.chkNew')}</b> ({t('add.chkOf', { total: checkSummary.total })})
                  </p>
                  {checkSummary.new > 0 && (
                    <button className="ghostbtn" style={{ marginBottom: 8 }} onClick={addAllNewToWishlist} disabled={busy}>
                      ★ {t('add.addNewToWishlist', { count: checkSummary.new })}
                    </button>
                  )}
                  <div className="checkres">
                    {checkResults.map((r, i) => (
                      <div className={`checkrow ${r.status}`} key={i}>
                        <span className="cstat">{r.status === 'owned' ? '✓' : r.status === 'wishlist' ? '★' : '＋'}</span>
                        <span className="ctitle">{r.input}{r.match && r.match !== r.input && r.status === 'owned' ? ` → ${r.match}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {method === 'steam' && (
            <>
              <div className="field">
                <label>{t('add.steamIdLabel')}</label>
                <input
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="7656119…  ·  vanity name  ·  profile URL"
                  autoFocus
                />
                <span className="sethint">{t('add.steamHint')}</span>
              </div>
              <button className="primary" onClick={runSteamImport} disabled={busy || !steamId.trim()}>
                {busy ? '…' : t('add.steamBtn')}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              <p className="mnote" style={{ padding: '12px 0 0', border: 0 }}>{t('add.steamNote')}</p>
            </>
          )}

          {method === 'console' && (
            <>
              <p className="mnote" style={{ padding: '0 0 10px', border: 0 }}>{t('add.consoleHint')}</p>
              <div className="consolegrid">
                {CONSOLES.map((c) => {
                  const owned = ownedConsoles.has(c.name);
                  return (
                    <button
                      key={c.name}
                      className={`concard ${owned ? 'owned' : ''}`}
                      onClick={() => !owned && addConsole(c.name, c.image)}
                      disabled={owned || busyConsole === c.name}
                      title={c.name}
                    >
                      <span className="conimg"><img src={c.image} alt="" loading="lazy" /></span>
                      <span className="conname">{c.name}</span>
                      {owned ? <span className="conbadge">✓</span> : busyConsole === c.name ? <span className="conbadge">…</span> : <span className="conadd">＋</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
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
