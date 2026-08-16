import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { marketplaceItemUrl, type Marketplace } from '../marketplace';
import type { SearchHit } from '../types';

type Game = SearchHit & { status: 'owned' | 'wishlist' | 'owned-other' | 'none'; ownedOn: string | null };

// Comprehensive platform list → IGDB platform id + the format string used in the
// collection. Grouped by maker; IGDB ids verified against the /platforms endpoint.
const PLATFORMS: { label: string; igdb: number; format: string }[] = [
  // Microsoft
  { label: 'Xbox Series X|S', igdb: 169, format: 'Xbox Series' },
  { label: 'Xbox One', igdb: 49, format: 'Xbox One' },
  { label: 'Xbox 360', igdb: 12, format: 'Xbox 360' },
  { label: 'Xbox', igdb: 11, format: 'Xbox' },
  // Sony
  { label: 'PlayStation 5', igdb: 167, format: 'PS5' },
  { label: 'PlayStation 4', igdb: 48, format: 'PS4' },
  { label: 'PlayStation 3', igdb: 9, format: 'PS3' },
  { label: 'PlayStation 2', igdb: 8, format: 'PS2' },
  { label: 'PlayStation', igdb: 7, format: 'PS1' },
  { label: 'PS Vita', igdb: 46, format: 'Vita' },
  { label: 'PSP', igdb: 38, format: 'PSP' },
  // Nintendo
  { label: 'Nintendo Switch 2', igdb: 508, format: 'Switch 2' },
  { label: 'Nintendo Switch', igdb: 130, format: 'Switch' },
  { label: 'Wii U', igdb: 41, format: 'Wii U' },
  { label: 'Wii', igdb: 5, format: 'Wii' },
  { label: 'GameCube', igdb: 21, format: 'GameCube' },
  { label: 'Nintendo 64', igdb: 4, format: 'N64' },
  { label: 'SNES', igdb: 19, format: 'SNES' },
  { label: 'NES', igdb: 18, format: 'NES' },
  { label: 'Nintendo 3DS', igdb: 37, format: '3DS' },
  { label: 'Nintendo DS', igdb: 20, format: 'DS' },
  { label: 'Game Boy Advance', igdb: 24, format: 'GBA' },
  { label: 'Game Boy Color', igdb: 22, format: 'GBC' },
  { label: 'Game Boy', igdb: 33, format: 'Game Boy' },
  // Sega
  { label: 'Dreamcast', igdb: 23, format: 'Dreamcast' },
  { label: 'Sega Saturn', igdb: 32, format: 'Saturn' },
  { label: 'Mega Drive / Genesis', igdb: 29, format: 'Genesis' },
  { label: 'Master System', igdb: 64, format: 'Master System' },
  { label: 'Game Gear', igdb: 35, format: 'Game Gear' },
  // Other
  { label: 'TurboGrafx-16 / PC Engine', igdb: 86, format: 'PC Engine' },
  { label: 'Neo Geo (AES)', igdb: 80, format: 'Neo Geo' },
  { label: 'Atari 2600', igdb: 59, format: 'Atari 2600' },
  { label: 'Commodore 64', igdb: 15, format: 'C64' },
  { label: 'PC', igdb: 6, format: 'PC' },
];

export function Catalogue({
  onClose,
  onChanged,
  marketplaces,
}: {
  onClose: () => void;
  onChanged: () => void;
  marketplaces: Marketplace[];
}) {
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
              {g.status === 'owned-other' && (
                <span className="catbadge other" title={t('catalogue.ownedOnTitle', { platform: g.ownedOn })}>
                  ✓ {g.ownedOn}
                </span>
              )}
              {(g.status === 'none' || g.status === 'owned-other') && (
                <button className="catadd" onClick={() => addToWishlist(g)} disabled={busyId === g.sourceId}>
                  {busyId === g.sourceId ? '…' : `★ ${t('catalogue.want')}`}
                </button>
              )}
            </div>
            <div className="meta">
              <p className="mt">{g.title}</p>
              <div className="ms"><span>{g.year || ''}</span><span>{g.rating != null ? `★ ${Math.round(g.rating)}` : ''}</span></div>
              {marketplaces.length > 0 && (
                <details className="catshops">
                  <summary>🔎 {t('catalogue.deals')}</summary>
                  <div className="shops">
                    {marketplaces.map((m) => (
                      <a
                        key={m.id}
                        href={marketplaceItemUrl(m, { title: g.title, format: platform.format, type: 'game' })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {m.label}
                      </a>
                    ))}
                  </div>
                </details>
              )}
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
