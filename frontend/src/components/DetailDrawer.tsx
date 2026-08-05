import type { Item } from '../types';
import { TYPE_META } from '../types';

interface Props {
  item: Item | null;
  onClose: () => void;
  onReenrich: (item: Item) => void;
  onDelete: (item: Item) => void;
  enriching: boolean;
  sourceOn: boolean;
}

export function DetailDrawer({ item, onClose, onReenrich, onDelete, enriching, sourceOn }: Props) {
  const open = Boolean(item);
  const meta = item ? TYPE_META[item.type] : null;

  const rows: [string, string | null][] = item
    ? [
        ['Format', item.format],
        ['Year', item.year ? String(item.year) : null],
        ['Rating', item.rating !== null ? `${Math.round(item.rating)} / 100` : null],
        ['Catalog no.', item.catalog_no],
        ['Location', item.location],
        ['Condition', item.condition],
        ['Notes', item.notes],
        ['Source', item.source ? item.source.toUpperCase() : null],
      ]
    : [];

  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Item details">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {item && meta && (
          <>
            <div className="dhead">
              <div className="dcover" style={{ background: meta.color }}>
                {item.cover_url ? (
                  <img src={item.cover_url} alt={item.title} />
                ) : (
                  <span>{item.title}</span>
                )}
              </div>
            </div>
            <h2>{item.title}</h2>
            <p className="dtype">{meta.label}</p>
            {item.description && <p className="ddesc">{item.description}</p>}
            <dl>
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div className="row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
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
              <button className="ghostbtn" onClick={() => onDelete(item)}>
                Delete
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
