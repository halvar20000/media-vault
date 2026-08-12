import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { LANGUAGES } from './i18n';
import type { Cabinet, EnrichStatus, Item, MediaType, Stats, User } from './types';
import { TYPE_META, TYPE_ORDER } from './types';
import { getMarketplaces, marketplaceBundleUrl, setEasycashStore, easycashStoreLabel, easycashStoreBrowseUrl, type Marketplace } from './marketplace';
import { Auth } from './components/Auth';
import { Shelf } from './components/Shelf';
import { Gallery } from './components/Gallery';
import { DetailDrawer } from './components/DetailDrawer';
import { AddModal } from './components/AddModal';
import { Catalogue } from './components/Catalogue';

const NO_SOURCES: EnrichStatus['sources'] = { igdb: false, tmdb: false, discogs: false };

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [sources, setSources] = useState<EnrichStatus['sources']>(NO_SOURCES);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);

  const [active, setActive] = useState<'all' | MediaType>('all');
  const [activeFormat, setActiveFormat] = useState<string>('all');
  const [formatOptions, setFormatOptions] = useState<{ format: string; count: number }[]>([]);
  const [noBarcode, setNoBarcode] = useState(false);
  const [wishlistView, setWishlistView] = useState(false);
  const [sort, setSort] = useState('title');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'shelf' | 'grid'>('shelf');

  const [selected, setSelected] = useState<Item | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichLine, setEnrichLine] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const [valueSources, setValueSources] = useState({ ebay: false, pricecharting: false, discogs: false });
  const [valuing, setValuing] = useState(false);
  const valuePollRef = useRef<number | null>(null);

  // ---- initial session check ----
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // Public: which second-hand marketplace(s) the "find deals" links target.
    api.authConfig().then((c) => {
      setEasycashStore(c.easycashStore);
      setMarketplaces(getMarketplaces(c.marketplaces));
    }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    const [{ items }, stats] = await Promise.all([
      api.listItems({
        type: active === 'all' ? undefined : active,
        q: query || undefined,
        format: activeFormat === 'all' ? undefined : activeFormat,
        nobarcode: noBarcode || undefined,
        sort,
        wishlist: wishlistView || undefined,
      }),
      api.stats(),
    ]);
    setItems(items);
    setStats(stats);
  }, [active, query, activeFormat, noBarcode, sort, wishlistView]);

  function exportCsv() {
    const a = document.createElement('a');
    a.href = '/api/items/export';
    a.download = 'media-vault-export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Load the console/format facet options for the selected media type.
  useEffect(() => {
    setActiveFormat('all');
    if (!user || active === 'all') {
      setFormatOptions([]);
      return;
    }
    api.formats(active).then((r) => setFormatOptions(r.formats)).catch(() => setFormatOptions([]));
  }, [active, user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  // Load source availability + cabinets once signed in.
  useEffect(() => {
    if (!user) return;
    api.enrichStatus().then((s) => setSources(s.sources)).catch(() => {});
    api.valueStatus().then((s) => setValueSources(s.sources)).catch(() => {});
    api.listCabinets().then((r) => setCabinets(r.cabinets)).catch(() => {});
  }, [user]);

  const refreshCabinets = useCallback(async () => {
    try { setCabinets((await api.listCabinets()).cabinets); } catch { /* ignore */ }
  }, []);

  // Called whenever the drawer changes an item (edit / apply-match / cover).
  async function applyUpdated(updated: Item) {
    updated.cabinet_name = cabinets.find((c) => c.id === updated.cabinet_id)?.name ?? null;
    setSelected((cur) => (cur && cur.id === updated.id ? updated : cur));
    await Promise.all([refresh(), refreshCabinets()]);
  }

  async function createCabinet(name: string) {
    try {
      const { cabinet } = await api.createCabinet(name);
      await refreshCabinets();
      return cabinet;
    } catch (e: any) {
      flash(e.message || 'Could not create cabinet');
      return null;
    }
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }

  // ---- collection enrichment (background job + polling) ----
  async function startEnrich() {
    setEnriching(true);
    setEnrichLine('Starting…');
    try {
      await api.startEnrich(false);
      poll();
    } catch (e: any) {
      setEnriching(false);
      flash(e.message || 'Could not start enrichment');
    }
  }

  function poll() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await api.enrichStatus();
        await refresh();
        const job = s.job;
        if (job) {
          const done = (job.summary?.enriched ?? 0) + (job.summary?.cached ?? 0);
          setEnrichLine(job.running ? `Enriching… ${stats?.enriched ?? done} done` : null);
          if (!job.running) {
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            setEnriching(false);
            setEnrichLine(null);
            const sm = job.summary;
            if (sm) {
              flash(
                `Enriched ${sm.enriched}, cached ${sm.cached}` +
                  (sm.noMatch ? `, ${sm.noMatch} no-match` : '') +
                  (sm.disabled ? `, ${sm.disabled} skipped (source off)` : '')
              );
            }
          }
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
  }

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  // ---- collection valuation (background job + polling) ----
  async function startValue() {
    setValuing(true);
    try {
      await api.startValue();
      if (valuePollRef.current) window.clearInterval(valuePollRef.current);
      valuePollRef.current = window.setInterval(async () => {
        try {
          const s = await api.valueStatus();
          await refresh();
          if (s.job && !s.job.running) {
            window.clearInterval(valuePollRef.current!);
            valuePollRef.current = null;
            setValuing(false);
            const sm = s.job.summary as any;
            if (sm) flash(`Valued ${sm.valued}` + (sm.noMatch ? `, ${sm.noMatch} no price` : '') + (sm.disabled ? `, ${sm.disabled} skipped` : ''));
          }
        } catch { /* keep polling */ }
      }, 1500);
    } catch (e: any) {
      setValuing(false);
      flash(e.message || 'Could not start valuation');
    }
  }
  useEffect(() => () => { if (valuePollRef.current) window.clearInterval(valuePollRef.current); }, []);

  // Format the collection total, e.g. "USD 1,234 · EUR 56".
  function formatTotals(totals: { currency: string; total: number }[]): string {
    if (!totals.length) return '—';
    return totals.map((v) => `${v.currency} ${Math.round(v.total).toLocaleString()}`).join(' · ');
  }

  async function deleteItem(item: Item) {
    if (!confirm(t('drawer.confirmDelete', { title: item.title }))) return;
    await api.deleteItem(item.id);
    setSelected(null);
    await refresh();
  }

  async function logout() {
    await api.logout();
    setUser(null);
    setItems([]);
    setStats(null);
  }

  if (loading) {
    return <div className="authwrap"><div className="authsub">{t('common.loading')}</div></div>;
  }
  if (!user) return <Auth onAuthed={setUser} />;

  const sourceForActiveDrawer = selected
    ? sources[selected.type === 'game' ? 'igdb' : selected.type === 'movie' ? 'tmdb' : 'discogs']
    : false;
  const valueSourceForActiveDrawer = selected
    ? selected.type === 'game'
      ? valueSources.ebay || valueSources.pricecharting
      : selected.type === 'movie'
        ? false
        : valueSources.discogs
    : false;

  const counts = stats?.byType ?? {};
  const anySource = sources.igdb || sources.tmdb || sources.discogs;
  const anyValueSource = valueSources.ebay || valueSources.pricecharting || valueSources.discogs;
  const hasValue = (stats?.totalValue?.length ?? 0) > 0;

  return (
    <>
      <header>
        <div className="brand">
          <h1>media-vault<span className="dot">.</span></h1>
          <span className="sub">{t('brand.sub')}</span>
        </div>
        <div className="searchwrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder={t('header.searchPlaceholder')}
            aria-label={t('common.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="headerbtns">
          <button className="addbtn" onClick={() => setAddOpen(true)}>{t('header.addItem')}</button>
          <button className="ghostbtn" onClick={exportCsv} title={t('header.export')}>⭳ CSV</button>
          <select
            className="langsel"
            aria-label="Language"
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button className="ghostbtn" onClick={logout}>{t('header.signOut')}</button>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><b>{stats?.total ?? 0}</b><span>{t('stats.itemsTotal')}</span></div>
        {TYPE_ORDER.map((mt) => (
          <div className="stat" key={mt}>
            <span className="swatch" style={{ background: TYPE_META[mt].color }} />
            <b>{counts[mt] ?? 0}</b>
            <span>{t(`types_plural.${mt}`)}</span>
          </div>
        ))}
        {(stats?.wishlist ?? 0) > 0 && (
          <div className="stat">
            <span className="swatch" style={{ background: 'var(--accent)' }} />
            <b>{stats!.wishlist}</b>
            <span>{t('stats.wishlist')}</span>
          </div>
        )}
        {hasValue && (
          <div className="stat valuestat">
            <b>{formatTotals(stats!.totalValue)}</b>
            <span>{t('stats.collectionValue')}</span>
          </div>
        )}
      </div>

      <div className="controls">
        <div className="filters">
          <button className="chip" aria-pressed={active === 'all'} onClick={() => setActive('all')}>{t('filters.all')}</button>
          {TYPE_ORDER.map((mt) => (
            <button className="chip" key={mt} aria-pressed={active === mt} onClick={() => setActive(mt)}>
              <span className="sw" style={{ background: TYPE_META[mt].color }} />
              {t(`types_plural.${mt}`)}
            </button>
          ))}
          {active !== 'all' && formatOptions.length > 0 && (
            <select
              className="formatsel"
              value={activeFormat}
              onChange={(e) => setActiveFormat(e.target.value)}
              aria-label={active === 'game' ? t('filters.allPlatforms') : t('filters.allFormats')}
            >
              <option value="all">
                {active === 'game' ? t('filters.allPlatforms') : t('filters.allFormats')}
              </option>
              {formatOptions.map((f) => (
                <option key={f.format} value={f.format}>
                  {f.format} ({f.count})
                </option>
              ))}
            </select>
          )}
          <button className="chip" aria-pressed={noBarcode} onClick={() => setNoBarcode((v) => !v)} title={t('filters.needsBarcode')}>
            ▯ {t('filters.needsBarcode')}
          </button>
          <button className="chip" aria-pressed={wishlistView} onClick={() => setWishlistView((v) => !v)} title={t('filters.wishlist')}>
            {t('filters.wishlist')}
          </button>
          {marketplaces.map((m) => (
            <a
              key={m.id}
              className="chip"
              href={marketplaceBundleUrl(m, active, activeFormat !== 'all' ? activeFormat : undefined)}
              target="_blank"
              rel="noopener noreferrer"
              title={t('filters.bundlesTitle', { marketplace: m.label })}
              style={{ textDecoration: 'none' }}
            >
              🔎 {m.label}
            </a>
          ))}
        </div>
        <div className="rightcontrols">
          <div className="enrich">
            {enrichLine && <span className="enrichprog">{enrichLine}</span>}
            <button
              className="enrichbtn"
              onClick={startEnrich}
              disabled={enriching || !anySource}
              title={anySource ? t('controls.enrichTitle') : t('controls.enrichNoSource')}
            >
              {enriching ? t('controls.enriching') : t('controls.enrich')}
            </button>
            <button
              className="enrichbtn"
              onClick={startValue}
              disabled={valuing || !anyValueSource}
              title={anyValueSource ? t('controls.valueTitle') : t('controls.valueNoSource')}
            >
              {valuing ? t('controls.valuing') : t('controls.value')}
            </button>
          </div>
          <select className="formatsel" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('sort.label')}>
            {['title', 'added', 'rating', 'value', 'year'].map((s) => (
              <option key={s} value={s}>{t(`sort.${s}`)}</option>
            ))}
          </select>
          <div className="viewtoggle" role="group" aria-label="View">
            <button aria-pressed={view === 'shelf'} onClick={() => setView('shelf')}>{t('controls.shelf')}</button>
            <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{t('controls.gallery')}</button>
          </div>
          {sources.igdb && (
            <button className="ghostbtn" onClick={() => setCatalogueOpen(true)} title={t('catalogue.hint')}>
              {t('controls.catalogue')}
            </button>
          )}
          {marketplaces.some((m) => m.id === 'easycash') && easycashStoreLabel() && (
            <a
              className="ghostbtn"
              href={easycashStoreBrowseUrl('game', active === 'game' && activeFormat !== 'all' ? activeFormat : undefined)}
              target="_blank"
              rel="noopener noreferrer"
              title={t('controls.easycashStoreTitle', { store: easycashStoreLabel() })}
              style={{ textDecoration: 'none' }}
            >
              🎮 Easy Cash {easycashStoreLabel()}
              {active === 'game' && activeFormat !== 'all' ? ` · ${activeFormat}` : ''}
            </a>
          )}
        </div>
      </div>

      {view === 'shelf' ? (
        <Shelf items={items} onOpen={setSelected} />
      ) : (
        <Gallery items={items} onOpen={setSelected} />
      )}

      <DetailDrawer
        item={selected}
        cabinets={cabinets}
        sourceOn={sourceForActiveDrawer}
        valueSourceOn={valueSourceForActiveDrawer}
        marketplaces={marketplaces}
        onClose={() => setSelected(null)}
        onUpdated={applyUpdated}
        onDelete={deleteItem}
        onCreateCabinet={createCabinet}
      />

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} sources={sources} />

      {catalogueOpen && (
        <div className="catoverlay">
          <Catalogue onClose={() => setCatalogueOpen(false)} onChanged={refresh} marketplaces={marketplaces} />
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
