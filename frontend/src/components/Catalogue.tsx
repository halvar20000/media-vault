import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { SearchHit } from '../types';

type Game = SearchHit & { status: 'owned' | 'wishlist' | 'none' };

// Curated platform list → IGDB platform id + the format string used in the collection.
const PLATFORMS: { label: string; igdb: number; format: string }[] = [
  { label: 'PlayStation 2', igdb: 8, format: 'PS2' },
  { label: 'PlayStation', igdb: 7, format: 'PS1' },
  { label: 'PlayStation 3', igdb: 9, format: 'PS3' },
  { label: 'PlayStation 4', igdb: 48, format: 'PS4' },
  { label: 'PlayStation 5', igdb: 167, format: 'PS5' },
  { label: 'PSP', igdb: 38, format: 'PSP' },
  { label: 'Xbox', igdb: 11, format: 'Xbox' },
  { label: 'Xbox 360', igdb: 12, format: 'Xbox 360' },
  { label: 'Xbox One', igdb: 49, format: 'Xbox One' },
  { label: 'Wii', igdb: 5, format: 'Wii' },
  { label: 'Wii U', igdb: 41, format: 'Wii U' },
  { label: 'Switch', igdb: 130, format: 'Switch' },
  { label: 'GameCube', igdb: 21, format: 'GameCube' },
  { label: 'Nintendo 64', igdb: 4, format: 'N64' },
  { label: 'Nintendo DS', igdb: 20, format: 'DS' },
  { label: 'Nintendo 3DS', igdb: 37, format: '3DS' },
  { label: 'Game Boy Advance', igdb: 24, format: 'GBA' },
  { label: 'SNES', igdb: 19, format: 'SNES' },
  { label: 'NES', igdb: 18, format: 'NES' },
  { label: 'PC', igdb: 6, format: 'PC' },
];

export function Catalogue({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('popular');
  const [games, setGames] = useState<Game[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      try {
        const off = reset ? 0 : offset;
        const r = await api.catalogue({ platform: platform.igdb, format: platform.format, q: q || undefined, sort, offset: off });
        setGames((prev) => (reset ? r.games : [...prev, ...r.games]));
        setOffset(off + r.games.length);
        setHasMore(r.hasMore);
      } catch {
        if (reset) setGames([]);
      } finally {
        setLoading(false);
      }
    },
    [platform, q, sort, offset]
  );

  // Reload from scratch when platform/sort change (and on mount).
  useEffect(() => {
    setOffset(0);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, sort]);

  async function addToWishlist(g: Game) {
    setBusyId(g.sourceId);
    try {
      await api.createItem(
        {
          type: 'game',
          title: g.title,
          format: platform.format,
          year: g.year ?? undefined,
          cover_url: g.coverUrl ?? undefined,
          rating: g.rating ?? undefined,
          description: g.description ?? undefined,
          source: 'igdb',
          source_id: g.sourceId,
          wishlist: true,
        },
        true
      );
      setGames((gs) => gs.map((x) => (x.sourceId === g.sourceId ? { ...x, status: 'wishlist' } : x)));
      onChanged();
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="catalogue">
      <div className="catbar">
        <select value={platform.igdb} onChange={(e) => setPlatform(PLATFORMS.find((p) => p.igdb === Number(e.target.value))!)}>
          {PLATFORMS.map((p) => <option key={p.igdb} value={p.igdb}>{p.label}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setOffset(0); load(true); }} style={{ flex: 1, minWidth: 160 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('catalogue.searchPlaceholder')} />
        </form>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="popular">{t('catalogue.sortPopular')}</option>
          <option value="rating">{t('sort.rating')}</option>
          <option value="year">{t('sort.year')}</option>
          <option value="name">{t('sort.title')}</option>
        </select>
        <button className="ghostbtn" onClick={onClose}>✕ {t('catalogue.close')}</button>
      </div>

      <div className="grid">
        {games.map((g) => (
          <div key={g.sourceId} className={`catcard ${g.status}`}>
            <div className="cover" style={{ background: '#2a3340' }}>
              {g.coverUrl && <img src={g.coverUrl} alt="" loading="lazy" />}
              {g.status === 'owned' && <span className="catbadge owned">✓ {t('catalogue.owned')}</span>}
              {g.status === 'wishlist' && <span className="catbadge wish">★</span>}
              {g.status === 'none' && (
                <button className="catadd" onClick={() => addToWishlist(g)} disabled={busyId === g.sourceId}>
                  {busyId === g.sourceId ? '…' : `★ ${t('catalogue.want')}`}
                </button>
              )}
            </div>
            <div className="meta">
              <p className="mt">{g.title}</p>
              <div className="ms"><span>{g.year || ''}</span><span>{g.rating != null ? `★ ${Math.round(g.rating)}` : ''}</span></div>
            </div>
          </div>
        ))}
      </div>

      {loading && <p className="shelfhint">{t('common.loading')}</p>}
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', padding: '0 28px 40px' }}>
          <button className="ghostbtn" onClick={() => load(false)}>{t('catalogue.more')}</button>
        </div>
      )}
      {!loading && !games.length && <div className="empty"><b>{t('catalogue.empty')}</b></div>}
    </div>
  );
}
