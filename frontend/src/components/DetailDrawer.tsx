import { useEffect, useState } from 'react';
import type { Cabinet, Item } from '../types';
import { TYPE_META } from '../types';

interface Props {
  item: Item | null;
  cabinets: Cabinet[];
  onClose: () => void;
  onReenrich: (item: Item) => void;
  onDelete: (item: Item) => void;
  onSave: (id: string, patch: Partial<Item>) => Promise<void>;
  onCreateCabinet: (name: string) => Promise<Cabinet | null>;
  enriching: boolean;
  sourceOn: boolean;
}

type Draft = {
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
};

function toDraft(i: Item): Draft {
  return {
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
  };
}

function fmtDate(s: string | null): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

export function DetailDrawer({
  item, cabinets, onClose, onReenrich, onDelete, onSave, onCreateCabinet, enriching, sourceOn,
}: Props) {
  const open = Boolean(item);
  const meta = item ? TYPE_META[item.type] : null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCabinet, setNewCabinet] = useState('');

  // Reset edit state whenever the selected item changes.
  useEffect(() => {
    setEditing(false);
    setDraft(item ? toDraft(item) : null);
    setNewCabinet('');
  }, [item?.id]);

  if (!item || !meta) {
    return (
      <>
        <div className="scrim" onClick={onClose} />
        <aside className="drawer" aria-hidden="true" />
      </>
    );
  }

  const cabinetName =
    item.cabinet_name ?? cabinets.find((c) => c.id === item.cabinet_id)?.name ?? null;

  async function quick(patch: Partial<Item>) {
    setSaving(true);
    try {
      await onSave(item!.id, patch);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdits() {
    if (!draft) return;
    setSaving(true);
    try {
      let cabinetId: string | null = draft.cabinet_id || null;
      if (draft.cabinet_id === '__new__' && newCabinet.trim()) {
        const created = await onCreateCabinet(newCabinet.trim());
        cabinetId = created?.id ?? null;
      }
      const patch: Partial<Item> = {
        condition: draft.condition || null,
        location: draft.location || null,
        notes: draft.notes || null,
        disc_count: draft.disc_count ? parseInt(draft.disc_count, 10) : null,
        is_series: draft.is_series,
        season_count: draft.is_series && draft.season_count ? parseInt(draft.season_count, 10) : null,
        episode_count: draft.is_series && draft.episode_count ? parseInt(draft.episode_count, 10) : null,
        lent_to: draft.lent_to || null,
        lent_since: draft.lent_to ? draft.lent_since || null : null,
        cabinet_id: cabinetId,
      };
      await onSave(item!.id, patch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string | null][] = [
    ['Format', item.format],
    ['Year', item.year ? String(item.year) : null],
    ['Rating', item.rating !== null ? `${Math.round(item.rating)} / 100` : null],
    ['Catalog no.', item.catalog_no],
    ['Cabinet', cabinetName],
    ['Location', item.location],
    ['Condition', item.condition],
    ['Discs', item.disc_count != null ? String(item.disc_count) : null],
    ['Series', item.is_series
      ? [item.season_count ? `${item.season_count} season(s)` : null,
         item.episode_count ? `${item.episode_count} ep.` : null].filter(Boolean).join(' · ') || 'Yes'
      : null],
    ['Lent to', item.lent_to ? `${item.lent_to}${item.lent_since ? ` (since ${fmtDate(item.lent_since)})` : ''}` : null],
    ['Viewed', item.viewed_at ? fmtDate(item.viewed_at) : null],
    ['Notes', item.notes],
    ['Source', item.source ? item.source.toUpperCase() : null],
  ];

  const d = draft!;
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });

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
        <p className="dtype">{meta.label}</p>
        {item.description && !editing && <p className="ddesc">{item.description}</p>}

        {!editing ? (
          <>
            {/* quick actions */}
            <div className="dactions" style={{ paddingTop: 4 }}>
              <button className="ghostbtn" onClick={() => setEditing(true)}>Edit</button>
              {item.viewed_at ? (
                <button className="ghostbtn" onClick={() => quick({ viewed_at: null })} disabled={saving}>Unwatch</button>
              ) : (
                <button className="ghostbtn" onClick={() => quick({ viewed_at: new Date().toISOString() })} disabled={saving}>Mark viewed</button>
              )}
              {item.lent_to && (
                <button className="ghostbtn" onClick={() => quick({ lent_to: null, lent_since: null })} disabled={saving}>Returned</button>
              )}
            </div>
            <dl>
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div className="row" key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <div className="dactions">
              <button
                className="ghostbtn"
                onClick={() => onReenrich(item)}
                disabled={enriching || !sourceOn}
                title={sourceOn ? 'Fetch artwork, rating & description' : 'Source not configured'}
              >
                {enriching ? 'Enriching…' : item.enriched_at ? 'Re-fetch artwork' : 'Fetch artwork'}
              </button>
              <button className="ghostbtn" onClick={() => onDelete(item)}>Delete</button>
            </div>
          </>
        ) : (
          /* ---- edit form ---- */
          <div style={{ padding: '4px 22px 24px' }}>
            <div className="field">
              <label>Cabinet</label>
              <select value={d.cabinet_id} onChange={(e) => set({ cabinet_id: e.target.value })}>
                <option value="">— none —</option>
                {cabinets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ New cabinet…</option>
              </select>
            </div>
            {d.cabinet_id === '__new__' && (
              <div className="field">
                <label>New cabinet name</label>
                <input value={newCabinet} onChange={(e) => setNewCabinet(e.target.value)} placeholder="e.g. Cabinet A · shelf 3" autoFocus />
              </div>
            )}
            <div className="rowfields">
              <div className="field">
                <label>Location note</label>
                <input value={d.location} onChange={(e) => set({ location: e.target.value })} />
              </div>
              <div className="field">
                <label>Condition</label>
                <input value={d.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="loose / CIB / VG+…" />
              </div>
            </div>
            <div className="rowfields">
              <div className="field">
                <label>Disc count</label>
                <input type="number" min="0" value={d.disc_count} onChange={(e) => set({ disc_count: e.target.value })} />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none' }}>
                  <input type="checkbox" checked={d.is_series} onChange={(e) => set({ is_series: e.target.checked })} style={{ width: 'auto' }} />
                  Is a series / box set
                </label>
              </div>
            </div>
            {d.is_series && (
              <div className="rowfields">
                <div className="field">
                  <label>Seasons</label>
                  <input type="number" min="0" value={d.season_count} onChange={(e) => set({ season_count: e.target.value })} />
                </div>
                <div className="field">
                  <label>Episodes</label>
                  <input type="number" min="0" value={d.episode_count} onChange={(e) => set({ episode_count: e.target.value })} />
                </div>
              </div>
            )}
            <div className="rowfields">
              <div className="field">
                <label>Lent to</label>
                <input value={d.lent_to} onChange={(e) => set({ lent_to: e.target.value })} placeholder="friend's name" />
              </div>
              <div className="field">
                <label>Lent since</label>
                <input type="date" value={d.lent_since} onChange={(e) => set({ lent_since: e.target.value })} disabled={!d.lent_to} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
            </div>
            <div className="dactions" style={{ padding: 0 }}>
              <button className="primary" onClick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="ghostbtn" onClick={() => { setEditing(false); setDraft(toDraft(item)); }} disabled={saving}>Cancel</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
