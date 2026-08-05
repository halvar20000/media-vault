import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { EnrichStatus, Item, MediaType, Stats, User } from './types';
import { TYPE_META, TYPE_ORDER } from './types';
import { Auth } from './components/Auth';
import { Shelf } from './components/Shelf';
import { Gallery } from './components/Gallery';
import { DetailDrawer } from './components/DetailDrawer';
import { AddModal } from './components/AddModal';

const NO_SOURCES: EnrichStatus['sources'] = { igdb: false, tmdb: false, discogs: false };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<EnrichStatus['sources']>(NO_SOURCES);

  const [active, setActive] = useState<'all' | MediaType>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'shelf' | 'grid'>('shelf');

  const [selected, setSelected] = useState<Item | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichLine, setEnrichLine] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [itemEnriching, setItemEnriching] = useState(false);
  const pollRef = useRef<number | null>(null);

  // ---- initial session check ----
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    const [{ items }, stats] = await Promise.all([
      api.listItems({ type: active === 'all' ? undefined : active, q: query || undefined }),
      api.stats(),
    ]);
    setItems(items);
    setStats(stats);
  }, [active, query]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  // Load source availability once signed in.
  useEffect(() => {
    if (!user) return;
    api.enrichStatus().then((s) => setSources(s.sources)).catch(() => {});
  }, [user]);

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

  async function reenrichItem(item: Item) {
    setItemEnriching(true);
    try {
      const { item: updated } = await api.enrichItem(item.id);
      setSelected(updated);
      await refresh();
    } catch (e: any) {
      flash(e.message || 'Enrichment failed');
    } finally {
      setItemEnriching(false);
    }
  }

  async function deleteItem(item: Item) {
    if (!confirm(`Delete “${item.title}”?`)) return;
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
    return <div className="authwrap"><div className="authsub">Loading…</div></div>;
  }
  if (!user) return <Auth onAuthed={setUser} />;

  const sourceForActiveDrawer = selected
    ? sources[selected.type === 'game' ? 'igdb' : selected.type === 'movie' ? 'tmdb' : 'discogs']
    : false;

  const counts = stats?.byType ?? {};
  const anySource = sources.igdb || sources.tmdb || sources.discogs;

  return (
    <>
      <header>
        <div className="brand">
          <h1>media-vault<span className="dot">.</span></h1>
          <span className="sub">physical media archive</span>
        </div>
        <div className="searchwrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Search across games, films, vinyl…"
            aria-label="Search collection"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="headerbtns">
          <button className="addbtn" onClick={() => setAddOpen(true)}>+ Add item</button>
          <button className="ghostbtn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><b>{stats?.total ?? 0}</b><span>items total</span></div>
        {TYPE_ORDER.map((t) => (
          <div className="stat" key={t}>
            <span className="swatch" style={{ background: TYPE_META[t].color }} />
            <b>{counts[t] ?? 0}</b>
            <span>{TYPE_META[t].label}{(counts[t] ?? 0) === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      <div className="controls">
        <div className="filters">
          <button className="chip" aria-pressed={active === 'all'} onClick={() => setActive('all')}>All</button>
          {TYPE_ORDER.map((t) => (
            <button className="chip" key={t} aria-pressed={active === t} onClick={() => setActive(t)}>
              <span className="sw" style={{ background: TYPE_META[t].color }} />
              {TYPE_META[t].label}s
            </button>
          ))}
        </div>
        <div className="rightcontrols">
          <div className="enrich">
            {enrichLine && <span className="enrichprog">{enrichLine}</span>}
            <button
              className="enrichbtn"
              onClick={startEnrich}
              disabled={enriching || !anySource}
              title={anySource ? 'Fetch covers, ratings & descriptions' : 'No metadata sources configured'}
            >
              {enriching ? 'Enriching…' : '✦ Enrich collection'}
            </button>
          </div>
          <div className="viewtoggle" role="group" aria-label="View">
            <button aria-pressed={view === 'shelf'} onClick={() => setView('shelf')}>Shelf</button>
            <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Gallery</button>
          </div>
        </div>
      </div>

      {view === 'shelf' ? (
        <Shelf items={items} onOpen={setSelected} />
      ) : (
        <Gallery items={items} onOpen={setSelected} />
      )}

      <DetailDrawer
        item={selected}
        onClose={() => setSelected(null)}
        onReenrich={reenrichItem}
        onDelete={deleteItem}
        enriching={itemEnriching}
        sourceOn={sourceForActiveDrawer}
      />

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} sources={sources} />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
