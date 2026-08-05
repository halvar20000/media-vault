import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { TYPE_META, TYPE_ORDER } from '../types';
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
      if (!hits.length) setMsg('No matches found.');
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
      setMsg(`Imported ${r.imported} ${importKind === 'movies' ? 'movies' : 'games'}.`);
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
          <h3>Add to the archive</h3>
          <button className="close" style={{ position: 'static' }} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="methods">
          <button className="method" aria-pressed={method === 'search'} onClick={() => setMethod('search')}>
            <span className="mi">⌨︎</span>
            <span className="mh">Search title</span>
            <span className="md">Type a name, pick the match — cover art, rating &amp; description fill in.</span>
          </button>
          <button className="method" aria-pressed={method === 'import'} onClick={() => setMethod('import')}>
            <span className="mi">⇪</span>
            <span className="mh">Bulk import</span>
            <span className="md">Drop a games CSV (Title, Platform, EmulationStatus).</span>
          </button>
          <button className="method" aria-pressed={method === 'scan'} onClick={() => setMethod('scan')}>
            <span className="mi">📷</span>
            <span className="mh">Scan barcode</span>
            <span className="md">Use your device camera (best-effort, where supported).</span>
          </button>
        </div>

        <div className="mbody">
          {method === 'search' && (
            <>
              <div className="rowfields">
                <div className="field">
                  <label>Media type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                    {TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                </div>
                <form className="field" style={{ flex: 2 }} onSubmit={runSearch}>
                  <label>Title</label>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Bloodborne" autoFocus />
                </form>
              </div>
              {!sourceOn && (
                <p className="mnote" style={{ padding: 0, border: 0 }}>
                  <b>{sourceForType(type).toUpperCase()}</b> isn’t configured — add its key to your{' '}
                  <span className="api">.env</span> to search {TYPE_META[type].label}s.
                </p>
              )}
              <button className="primary" onClick={runSearch} disabled={busy || !sourceOn}>
                {busy ? 'Searching…' : 'Search'}
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
                  <label>Import type</label>
                  <select value={importKind} onChange={(e) => setImportKind(e.target.value as 'games' | 'movies')}>
                    <option value="games">Games list</option>
                    <option value="movies">Movies (FlickRack export)</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>CSV file</label>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" />
                </div>
              </div>
              <button className="primary" onClick={doImport} disabled={busy}>
                {busy ? 'Importing…' : `Import ${importKind}`}
              </button>
              {msg && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{msg}</p>}
              <p className="mnote">
                {importKind === 'games' ? (
                  <>Games: columns <span className="api">Title, Platform, EmulationStatus</span>.</>
                ) : (
                  <>Movies: a <span className="api">FlickRack</span> export (semicolon-separated; Titel, Format, Release, ASIN…). Titles are cleaned automatically.</>
                )}{' '}
                After importing, hit <b>Enrich collection</b> to fetch covers, ratings &amp; descriptions.
              </p>
            </>
          )}

          {method === 'scan' && <BarcodeScan onCode={(code) => { setMethod('search'); setType('cd'); setQ(code); }} />}
        </div>

        <p className="mnote">
          Metadata is fetched per media type: Games → <span className="api">IGDB</span> · Films →{' '}
          <span className="api">TMDB</span> · Vinyl / Singles / CD → <span className="api">Discogs</span>.
        </p>
      </div>
    </div>
  );
}

// Best-effort barcode scanning via the native BarcodeDetector API.
function BarcodeScan({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const AnyWin = window as any;
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      return;
    }
    const detector = new AnyWin.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (videoRef.current) {
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length) {
                onCode(codes[0].rawValue);
                return;
              }
            } catch {
              /* frame not ready */
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(e.message || 'Camera unavailable');
      }
    })();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  if (!supported) {
    return (
      <p className="mnote" style={{ padding: 0, border: 0 }}>
        Your browser doesn’t support in-page barcode detection. Use <b>Search title</b> or{' '}
        <b>Bulk import</b> instead. (Chrome/Edge on Android support this best.)
      </p>
    );
  }
  return (
    <div>
      <video ref={videoRef} style={{ width: '100%', borderRadius: 6, background: '#000' }} muted playsInline />
      {error && <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>{error}</p>}
      <p className="mnote" style={{ padding: '10px 0 0', border: 0 }}>
        Point the camera at an EAN/UPC barcode. On detection we’ll drop the code into search.
      </p>
    </div>
  );
}
