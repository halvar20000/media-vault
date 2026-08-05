import { useTranslation } from 'react-i18next';
import type { Item } from '../types';
import { TYPE_META } from '../types';
import { platformBadge } from '../platforms';

function ratingLabel(r: number | null): string | null {
  if (r === null || r === undefined) return null;
  return String(Math.round(r));
}

export function Gallery({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const { t } = useTranslation();
  if (!items.length) {
    return (
      <div className="empty">
        <b>{t('shelf.emptyTitle')}</b>
        {t('shelf.emptyBody')}
      </div>
    );
  }
  return (
    <div className="grid">
      {items.map((d) => {
        const meta = TYPE_META[d.type];
        const badge = platformBadge(d.format, d.type);
        const rating = ratingLabel(d.rating);
        return (
          <button key={d.id} className="card" onClick={() => onOpen(d)}>
            <div className="cover" style={{ background: meta.color }}>
              {d.cover_url && <img src={d.cover_url} alt="" loading="lazy" />}
              <span className="badge" style={{ background: badge.color }}>{badge.code || t(`types.${d.type}`)}</span>
              {rating && <span className="rate">★ {rating}</span>}
              {!d.cover_url && <span className="ct">{d.title}</span>}
            </div>
            <div className="meta">
              <p className="mt">{d.title}</p>
              <div className="ms">
                <span>{d.format || ''}</span>
                <span>{d.year || ''}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
