import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { Cabinet, Item, SearchHit } from '../types';
import { TYPE_META } from '../types';

interface Props {
  item: Item | null;
  cabinets: Cabinet[];
  sourceOn: boolean;
  valueSourceOn: boolean;
  onClose: () => void;
  onUpdated: (item: Item) => void | Promise<void>;
  onDelete: (item: Item) => void;
  onCreateCabinet: (name: string) => Promise<Cabinet | null>;
}

type Draft = {
  title: string;
  year: string;
  format: string;
  barcode: string;
  condition: string;
  location: string;
  notes: string;
  disc_count: string;
  is_series: boolean;
  season_count: string;
  episode_count: string;
  lent_to: string;
  lent_since: string;
  cabinet_id: string;
  value: string;
  value_currency: string;
  wishlist: boolean;
};

function toDraft(i: Item): Draft {
  return {
    title: i.title,
    year: i.year != null ? String(i.year) : '',
    format: i.format ?? '',
    barcode: i.barcode ?? '',
    condition: i.condition ?? '',
    location: i.location ?? '',
    notes: i.notes ?? '',
    disc_count: i.disc_count != null ? String(i.disc_count) : '',
    is_series: i.is_series,
    season_count: i.season_count != null ? String(i.season_count) : '',
    episode_count: i.episode_count != null ? String(i.episode_count) : '',
    lent_to: i.lent_to ?? '',
    lent_since: i.lent_since ? i.lent_since.slice(0, 10) : '',
    cabinet_id: i.cabinet_id ?? '',
    value: i.value != null ? String(i.value) : '',
    value_currency: i.value_currency ?? '',
    wishlist: i.wishlist,
  };
}

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : null);

export function DetailDrawer({ item, cabinets, sourceOn, valueSourceOn, onClose, onUpdated, onDelete, onCreateCabinet }: Props) {
  const { t } = useTranslation();
  const open = Boolean(item);
  const meta = item ? TYPE_META[item.type] : null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCabinet, setNewCabinet] = useState('');
  // fix-match state
  const [matchQ, setMatchQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [matchMsg, setMatchMsg] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(item ? toDraft(item) : null);
    setNewCabinet('');
    setHits([]);
    setMatchMsg(null);
    setMatchQ(item?.title ?? '');
    setCoverUrl('');
  }, [item?.id]);

  if (!item || !meta) {
    return (<><div className="scrim" onClick={onClose} /><aside className="drawer" aria-hidden="true" /></>);
  }

  const cabinetName = item.cabinet_name ?? cabinets.find((c) => c.id === item.cabinet_id)?.name ?? null;
  const d = draft!;
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });

  async function run(fn: () => Promise<Item>) {
    setBusy(true);
    try {
      const updated = await fn();
      await onUpdated(updated);
    } catch (e: any) {
      setMatchMsg(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const quick = (patch: Partial<Item>) => run(async () => (await api.updateItem(item!.id, patch)).item);
  const reenrich = () => run(async () => (await api.enrichItem(item!.id)).item);
  const fetchValue = () => run(async () => (await api.valueItem(item!.id)).item);

  async function searchMatches(e?: React.FormEvent) {
    e?.preventDefault();
    if (!matchQ.trim()) return;
    setBusy(true);
    setMatchMsg(null);
    try {
      const { hits } = await api.search(item!.type, matchQ.trim());
      setHits(hits);
      if (!hits.length) setMatchMsg(t('drawer.noMatchTry'));
    } catch (e: any) {
      setMatchMsg(e.message || 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  const applyHit = (hit: SearchHit) => run(async () => {
    const { item: updated } = await api.applyMatch(item!.id, hit);
    setHits([]);
    return updated;
  });

  // Persist the typed barcode on this item, then fetch exact matches by barcode.
  async function matchByBarcode() {
    const code = d.barcode.trim().replace(/\D/g, '');
    if (!code) return;
    setBusy(true);
    setMatchMsg(null);
    try {
      const { item: saved } = await api.updateItem(item!.id, { barcode: code });
      await onUpdated(saved);
      const { hits, resolvedTitle } = await api.barcodeLookup(item!.type, code);
      setHits(hits);
      if (!hits.length) setMatchMsg(resolvedTitle || t('add.barcodeNoProduct'));
    } catch (e: any) {
      setMatchMsg(e.message || 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }

  const uploadFile = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    return run(async () => (await api.uploadCover(item!.id, f)).item);
  };
  const applyCoverUrl = () => {
    if (!coverUrl.trim()) return;
    return run(async () => (await api.setCoverUrl(item!.id, coverUrl.trim())).item);
  };

  async function saveEdits() {
    setBusy(true);
    try {
      let cabinetId: string | null = d.cabinet_id || null;
      if (d.cabinet_id === '__new__' && newCabinet.trim()) {
        const created = await onCreateCabinet(newCabinet.trim());
        cabinetId = created?.id ?? null;
      }
      const patch: Partial<Item> = {
        title: d.title.trim() || item!.title,
        year: d.year ? parseInt(d.year, 10) : null,
        format: d.format || null,
        barcode: d.barcode.trim() || null,
        condition: d.condition || null,
        location: d.location || null,
        notes: d.notes || null,
        disc_count: d.disc_count ? parseInt(d.disc_count, 10) : null,
        is_series: d.is_series,
        season_count: d.is_series && d.season_count ? parseInt(d.season_count, 10) : null,
        episode_count: d.is_series && d.episode_count ? parseInt(d.episode_count, 10) : null,
        lent_to: d.lent_to || null,
        lent_since: d.lent_to ? d.lent_since || null : null,
        cabinet_id: cabinetId,
        value: d.value ? parseFloat(d.value) : null,
        value_currency: d.value ? d.value_currency || null : null,
        wishlist: d.wishlist,
      };
      const { item: updated } = await api.updateItem(item!.id, patch);
      await onUpdated(updated);
      setEditing(false);
    } catch (e: any) {
      setMatchMsg(e.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string | null][] = [
    [t('drawer.rowFormat'), item.format],
    [t('drawer.rowYear'), item.year ? String(item.year) : null],
    [t('drawer.rowRating'), item.rating !== null ? `${Math.round(item.rating)} / 100` : null],
    [t('drawer.rowCatalog'), item.catalog_no],
    [t('drawer.rowBarcode'), item.barcode],
    [t('drawer.rowCabinet'), cabinetName],
    [t('drawer.rowLocation'), item.location],
    [t('drawer.rowCondition'), item.condition],
    [t('drawer.rowDiscs'), item.disc_count != null ? String(item.disc_count) : null],
    [t('drawer.rowSeries'), item.is_series
      ? [item.season_count ? `${item.season_count} ${t('drawer.seasons')}` : null, item.episode_count ? `${item.episode_count} ${t('drawer.episodes')}` : null].filter(Boolean).join(' · ') || '✓'
      : null],
    [t('drawer.rowLentTo'), item.lent_to ? `${item.lent_to}${item.lent_since ? ` (${t('drawer.lentSince').toLowerCase()} ${fmtDate(item.lent_since)})` : ''}` : null],
    [t('drawer.rowViewed'), item.viewed_at ? fmtDate(item.viewed_at) : null],
    [t('drawer.rowValue'), item.value != null ? `${item.value_currency || ''} ${item.value}`.trim() + (item.value_source && item.value_source !== 'manual' ? ` · ${item.value_source}` : '') : null],
    [t('drawer.rowNotes'), item.notes],
    [t('drawer.rowSource'), item.source ? item.source.toUpperCase() : null],
  ];

  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-label="Item details">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="dhead">
          <div className="dcover" style={{ background: meta.color }}>
            {item.cover_url ? <img src={item.cover_url} alt={item.title} /> : <span>{item.title}</span>}
          </div>
        </div>
        <h2>{item.title}</h2>
        <p className="dtype">{t(`types.${item.type}`)}{item.wishlist && <span> · ★ {t('wishlist.badge')}</span>}</p>
        {item.description && !editing && <p className="ddesc">{item.description}</p>}

        {!editing ? (
          <>
            <div className="dactions" style={{ paddingTop: 4 }}>
              <button className="ghostbtn" onClick={() => setEditing(true)}>{t('common.edit')}</button>
              {item.wishlist && (
                <button className="ghostbtn" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={() => quick({ wishlist: false })} disabled={busy}>★ {t('wishlist.markOwned')}</button>
              )}
              {item.viewed_at
                ? <button className="ghostbtn" onClick={() => quick({ viewed_at: null })} disabled={busy}>{t('drawer.unwatch')}</button>
                : <button className="ghostbtn" onClick={() => quick({ viewed_at: new Date().toISOString() })} disabled={busy}>{t('drawer.markViewed')}</button>}
              {item.lent_to && <button className="ghostbtn" onClick={() => quick({ lent_to: null, lent_since: null })} disabled={busy}>{t('drawer.returned')}</button>}
            </div>
            <dl>
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div className="row" key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <div className="dactions">
              <button className="ghostbtn" onClick={reenrich} disabled={busy || !sourceOn}
                title={sourceOn ? t('controls.enrichTitle') : t('controls.enrichNoSource')}>
                {busy ? t('common.working') : item.enriched_at ? t('drawer.refetch') : t('drawer.fetch')}
              </button>
              {valueSourceOn && (
                <button className="ghostbtn" onClick={fetchValue} disabled={busy}>{t('drawer.fetchValue')}</button>
              )}
              <button className="ghostbtn" onClick={() => setEditing(true)} disabled={busy}>{t('drawer.fixMatch')}</button>
              <button className="ghostbtn dangerbtn" onClick={() => onDelete(item)}>{t('common.delete')}</button>
            </div>
          </>
        ) : (
          <div style={{ padding: '4px 22px 24px' }}>
            {/* ---- Fix match (search & pick) ---- */}
            {sourceOn && (
              <div className="fixblock">
                <label className="fixlabel">{t('drawer.rematchFrom', { source: item.source?.toUpperCase() || t(`types.${item.type}`) })}</label>
                <form className="rowfields" style={{ gap: 8 }} onSubmit={searchMatches}>
                  <input style={{ flex: 2 }} value={matchQ} onChange={(e) => setMatchQ(e.target.value)} placeholder={t('drawer.correctedTitle')} />
                  <button type="submit" className="ghostbtn" disabled={busy}>{t('common.search')}</button>
                </form>
                <form className="rowfields" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); matchByBarcode(); }}>
                  <input style={{ flex: 2 }} value={d.barcode} inputMode="numeric" onChange={(e) => set({ barcode: e.target.value })} placeholder={t('drawer.barcode')} />
                  <button type="submit" className="ghostbtn" disabled={busy || !d.barcode.trim()}>{t('drawer.matchByBarcode')}</button>
                </form>
                {hits.length > 0 && (
                  <div className="hits">
                    {hits.map((h) => (
                      <button className="hit" key={h.source + h.sourceId} onClick={() => applyHit(h)} disabled={busy}>
                        {h.coverUrl ? <img src={h.coverUrl} alt="" /> : <span className="noart" />}
                        <span className="hinfo"><b>{h.title}</b><span>{[h.year, h.format, h.rating !== null ? `★ ${Math.round(h.rating)}` : null].filter(Boolean).join(' · ')}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- Manual cover ---- */}
            <div className="fixblock">
              <label className="fixlabel">{t('drawer.manualCover')}</label>
              <div className="rowfields" style={{ gap: 8, alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 2, marginBottom: 0 }}>
                  <input ref={fileRef} type="file" accept="image/*" />
                </div>
                <button className="ghostbtn" onClick={uploadFile} disabled={busy}>{t('drawer.upload')}</button>
              </div>
              <div className="rowfields" style={{ gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                <div className="field" style={{ flex: 2, marginBottom: 0 }}>
                  <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder={t('drawer.pasteUrl')} />
                </div>
                <button className="ghostbtn" onClick={applyCoverUrl} disabled={busy}>{t('drawer.set')}</button>
              </div>
            </div>
            {matchMsg && <p className="mnote" style={{ padding: '4px 0 12px', border: 0 }}>{matchMsg}</p>}

            {/* ---- Core fields ---- */}
            <div className="field"><label>{t('drawer.title')}</label>
              <input value={d.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div className="rowfields">
              <div className="field"><label>{t('drawer.year')}</label>
                <input type="number" value={d.year} onChange={(e) => set({ year: e.target.value })} /></div>
              <div className="field"><label>{t('drawer.format')}</label>
                <input value={d.format} onChange={(e) => set({ format: e.target.value })} placeholder="PS4 / Blu-Ray…" /></div>
            </div>
            <div className="field"><label>{t('drawer.cabinet')}</label>
              <select value={d.cabinet_id} onChange={(e) => set({ cabinet_id: e.target.value })}>
                <option value="">{t('common.none')}</option>
                {cabinets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">{t('drawer.newCabinet')}</option>
              </select>
            </div>
            {d.cabinet_id === '__new__' && (
              <div className="field"><label>{t('drawer.newCabinetName')}</label>
                <input value={newCabinet} onChange={(e) => setNewCabinet(e.target.value)} placeholder="Cabinet A · shelf 3" /></div>
            )}
            <div className="rowfields">
              <div className="field"><label>{t('drawer.locationNote')}</label>
                <input value={d.location} onChange={(e) => set({ location: e.target.value })} /></div>
              <div className="field"><label>{t('drawer.condition')}</label>
                <input value={d.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="loose / CIB / VG+…" /></div>
            </div>
            <div className="rowfields">
              <div className="field"><label>{t('drawer.discCount')}</label>
                <input type="number" min="0" value={d.disc_count} onChange={(e) => set({ disc_count: e.target.value })} /></div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none' }}>
                  <input type="checkbox" checked={d.is_series} onChange={(e) => set({ is_series: e.target.checked })} style={{ width: 'auto' }} />
                  {t('drawer.isSeries')}
                </label>
              </div>
            </div>
            {d.is_series && (
              <div className="rowfields">
                <div className="field"><label>{t('drawer.seasons')}</label>
                  <input type="number" min="0" value={d.season_count} onChange={(e) => set({ season_count: e.target.value })} /></div>
                <div className="field"><label>{t('drawer.episodes')}</label>
                  <input type="number" min="0" value={d.episode_count} onChange={(e) => set({ episode_count: e.target.value })} /></div>
              </div>
            )}
            <div className="rowfields">
              <div className="field"><label>{t('drawer.lentTo')}</label>
                <input value={d.lent_to} onChange={(e) => set({ lent_to: e.target.value })} /></div>
              <div className="field"><label>{t('drawer.lentSince')}</label>
                <input type="date" value={d.lent_since} onChange={(e) => set({ lent_since: e.target.value })} disabled={!d.lent_to} /></div>
            </div>
            <div className="rowfields">
              <div className="field"><label>{t('drawer.value')}</label>
                <input type="number" step="0.01" min="0" value={d.value} onChange={(e) => set({ value: e.target.value })} /></div>
              <div className="field" style={{ maxWidth: 110 }}><label>{t('drawer.currency')}</label>
                <input value={d.value_currency} onChange={(e) => set({ value_currency: e.target.value })} placeholder="CHF" /></div>
            </div>
            <div className="field"><label>{t('drawer.notes')}</label>
              <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              <input type="checkbox" checked={d.wishlist} onChange={(e) => set({ wishlist: e.target.checked })} style={{ width: 'auto' }} />
              ★ {t('wishlist.moveTo')}
            </label>

            <div className="dactions" style={{ padding: 0 }}>
              <button className="primary" onClick={saveEdits} disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
              <button className="ghostbtn" onClick={() => { setEditing(false); setDraft(toDraft(item)); }} disabled={busy}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
