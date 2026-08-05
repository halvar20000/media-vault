import { useTranslation } from 'react-i18next';
import type { Item } from '../types';
import { TYPE_META } from '../types';

export function Shelf({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
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
    <>
      <div className="shelfscroll">
        <div className="shelf">
          {items.map((d) => {
            const color = TYPE_META[d.type].color;
            const hasArt = Boolean(d.cover_url);
            return (
              <button
                key={d.id}
                className={`spine${hasArt ? ' hasart' : ''}`}
                style={{ ['--c' as any]: color }}
                title={d.title}
                onClick={() => onOpen(d)}
              >
                <span className="splat">{d.format || t(`types.${d.type}`)}</span>
                {hasArt && <img className="art" src={d.cover_url!} alt="" loading="lazy" />}
                <span className="stitle">{d.title}</span>
                <span className="sid">{d.catalog_no || '—'}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="shelfhint">{t('shelf.hint')}</p>
    </>
  );
}
