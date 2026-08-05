import type { Item } from '../types';
import { TYPE_META } from '../types';

function ratingLabel(r: number | null): string | null {
  if (r === null || r === undefined) return null;
  return String(Math.round(r));
}

export function Gallery({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  if (!items.length) {
    return (
      <div className="empty">
        <b>Nothing here yet</b>
        Adjust the filter or add an item to this shelf.
      </div>
    );
  }
  return (
    <div className="grid">
      {items.map((d) => {
        const meta = TYPE_META[d.type];
        const rating = ratingLabel(d.rating);
        return (
          <button key={d.id} className="card" onClick={() => onOpen(d)}>
            <div className="cover" style={{ background: meta.color }}>
              {d.cover_url && <img src={d.cover_url} alt="" loading="lazy" />}
              <span className="badge">{meta.label}</span>
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
