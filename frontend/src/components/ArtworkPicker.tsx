import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { ArtworkOption, Item } from '../types';

interface Props {
  item: Item | null; // null = closed
  onClose: () => void;
  onUpdated: (item: Item) => void | Promise<void>;
}

// "Choose cover": every alternate the item's provider knows (posters in other
// languages, other pressings, regional boxes…) in a grid. Picking one goes
// through the normal cover endpoint, so it's cached locally like any other.
export function ArtworkPicker({ item, onClose, onUpdated }: Props) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ArtworkOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setOptions([]);
    setWarnings([]);
    setError(null);
    setSelected(item.cover_url);
    setLoading(true);
    api
      .artworkOptions(item.id)
      .then((r) => {
        if (cancelled) return;
        setOptions(r.options);
        setWarnings(r.warnings);
      })
      .catch((e: any) => !cancelled && setError(e?.message || t('artwork.failed')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, busy, onClose]);

  if (!item) return null;

  const unchanged = !selected || selected === item.cover_url;

  async function save() {
    if (!selected || unchanged) return onClose();
    setBusy(true);
    setError(null);
    try {
      const { item: updated } = await api.setCoverUrl(item!.id, selected);
      await onUpdated(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message || t('artwork.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="box" style={{ maxWidth: 760 }}>
        <div className="mtop">
          <div>
            <h3>{t('artwork.title')}</h3>
            <p className="setintro" style={{ margin: '4px 0 0' }}>{item.title}</p>
          </div>
          <button className="close" style={{ position: 'static' }} onClick={onClose} disabled={busy}>✕</button>
        </div>

        <div className="mbody">
          {loading && <p className="mnote" style={{ padding: '0 0 12px', border: 0 }}>{t('artwork.loading')}</p>}
          {error && <p className="mnote" style={{ padding: '0 0 12px', border: 0, color: '#e5484d' }}>{error}</p>}
          {warnings.map((w) => (
            <p key={w} className="mnote" style={{ padding: '0 0 12px', border: 0 }}>{t(w)}</p>
          ))}

          {options.length > 0 && (
            <div className="artgrid">
              {options.map((o) => {
                const isSel = selected === o.url;
                const isCurrent = o.url === item.cover_url;
                return (
                  <button
                    key={o.url}
                    type="button"
                    className={`artopt${isSel ? ' selected' : ''}`}
                    aria-pressed={isSel}
                    onClick={() => setSelected(o.url)}
                    disabled={busy}
                    title={o.label}
                  >
                    <img src={o.thumb} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = '0.25'; }} />
                    <span>{isCurrent ? t('artwork.current') : o.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && options.length <= 1 && !warnings.length && (
            <p className="mnote" style={{ padding: '0 0 12px', border: 0 }}>{t('artwork.none')}</p>
          )}

          <div className="mactions">
            <button className="ghostbtn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
            <button className="primary" onClick={save} disabled={busy || unchanged}>
              {busy ? t('common.saving') : t('artwork.use')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
