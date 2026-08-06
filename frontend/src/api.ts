import type { Cabinet, EnrichStatus, Item, MediaType, SearchHit, Stats, User, ValueStatus } from './types';

// All requests share cookies for session auth.
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  // auth
  authConfig: () => req<{ allowRegistration: boolean }>('/auth/config'),
  me: () => req<{ user: User }>('/auth/me'),
  login: (email: string, password: string) =>
    req<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, displayName?: string) =>
    req<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // items
  listItems: (params: { type?: string; q?: string; format?: string; nobarcode?: boolean; sort?: string; wishlist?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.q) qs.set('q', params.q);
    if (params.format) qs.set('format', params.format);
    if (params.nobarcode) qs.set('nobarcode', 'true');
    if (params.sort) qs.set('sort', params.sort);
    if (params.wishlist) qs.set('wishlist', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    return req<{ items: Item[] }>(`/items${suffix}`);
  },
  stats: () => req<Stats>('/items/stats'),
  formats: (type?: string) =>
    req<{ formats: { format: string; count: number }[] }>(
      `/items/formats${type ? `?type=${type}` : ''}`
    ),
  createItem: async (data: Partial<Item>, force = false) => {
    const res = await fetch(`/api/items${force ? '?force=true' : ''}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      const body = await res.json();
      const err = new Error('duplicate') as Error & { duplicate?: { id: string; title: string; format: string | null } };
      err.duplicate = body.existing;
      throw err;
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
    return (await res.json()) as { item: Item };
  },
  updateItem: (id: string, data: Partial<Item>) =>
    req<{ item: Item }>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (id: string) => req<{ ok: true }>(`/items/${id}`, { method: 'DELETE' }),

  // cabinets
  listCabinets: () => req<{ cabinets: Cabinet[] }>('/cabinets'),
  createCabinet: (name: string) =>
    req<{ cabinet: Cabinet }>('/cabinets', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCabinet: (id: string) => req<{ ok: true }>(`/cabinets/${id}`, { method: 'DELETE' }),

  // enrichment
  startEnrich: (force = false) =>
    req<{ status: string }>(`/enrich${force ? '?force=true' : ''}`, { method: 'POST' }),
  enrichStatus: () => req<EnrichStatus>('/enrich/status'),
  enrichItem: (id: string) =>
    req<{ item: Item }>(`/enrich/item/${id}`, { method: 'POST' }),

  // valuation
  startValue: () => req<{ status: string }>('/value', { method: 'POST' }),
  valueStatus: () => req<ValueStatus>('/value/status'),
  valueItem: (id: string) => req<{ item: Item }>(`/value/item/${id}`, { method: 'POST' }),

  // external search
  search: (type: MediaType, q: string) =>
    req<{ hits: SearchHit[] }>(`/search/${type}?q=${encodeURIComponent(q)}`),

  // barcode (EAN/UPC) lookup — manual entry or scan feed the same call
  barcodeLookup: (type: MediaType, code: string) =>
    req<{ resolvedTitle: string | null; hits: SearchHit[] }>(
      `/barcode/${type}/${encodeURIComponent(code)}`
    ),

  // apply a chosen search hit's artwork/rating/description to an existing item
  applyMatch: (id: string, hit: SearchHit) =>
    req<{ item: Item }>(`/items/${id}/apply-match`, {
      method: 'POST',
      body: JSON.stringify({
        source: hit.source,
        sourceId: hit.sourceId,
        coverUrl: hit.coverUrl,
        rating: hit.rating,
        description: hit.description,
      }),
    }),

  // manual cover: upload a file, or set from a URL
  uploadCover: async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/items/${id}/cover`, { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
    return (await res.json()) as { item: Item };
  },
  setCoverUrl: (id: string, url: string) =>
    req<{ item: Item }>(`/items/${id}/cover`, { method: 'POST', body: JSON.stringify({ url }) }),

  // CSV import (multipart). kind: 'games' | 'movies'
  importCsv: async (kind: 'games' | 'movies', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/import/${kind}`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
    return (await res.json()) as { imported: number; total: number };
  },
};
