import type { EnrichStatus, Item, MediaType, SearchHit, Stats, User } from './types';

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
  listItems: (params: { type?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs}` : '';
    return req<{ items: Item[] }>(`/items${suffix}`);
  },
  stats: () => req<Stats>('/items/stats'),
  createItem: (data: Partial<Item>) =>
    req<{ item: Item }>('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: Partial<Item>) =>
    req<{ item: Item }>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (id: string) => req<{ ok: true }>(`/items/${id}`, { method: 'DELETE' }),

  // enrichment
  startEnrich: (force = false) =>
    req<{ status: string }>(`/enrich${force ? '?force=true' : ''}`, { method: 'POST' }),
  enrichStatus: () => req<EnrichStatus>('/enrich/status'),
  enrichItem: (id: string) =>
    req<{ item: Item }>(`/enrich/item/${id}`, { method: 'POST' }),

  // external search
  search: (type: MediaType, q: string) =>
    req<{ hits: SearchHit[] }>(`/search/${type}?q=${encodeURIComponent(q)}`),

  // CSV import (multipart)
  importGames: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import/games', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
    return (await res.json()) as { imported: number; total: number };
  },
};
