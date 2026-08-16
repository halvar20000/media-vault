// Steam import via the official Web API (read-only). Needs a Steam Web API key
// and the target profile's game details set to Public.
// Docs: https://developer.valvesoftware.com/wiki/Steam_Web_API
import { getApiKeys } from '../lib/apikeys';

const HOST = 'https://api.steampowered.com';

export interface SteamGame {
  appid: number;
  name: string;
}

// Accepts a 64-bit SteamID, a vanity name, or a full profile URL, → SteamID64.
export async function resolveSteamId(input: string): Promise<string | null> {
  const key = getApiKeys().steamApiKey;
  if (!key) throw new Error('Steam API key not configured');
  let s = input.trim();

  // Pull the id/vanity out of a profile URL if one was pasted.
  const mId = s.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  const mVanity = s.match(/steamcommunity\.com\/id\/([^/\s?]+)/i);
  if (mId) return mId[1];
  if (mVanity) s = mVanity[1];

  // A bare 17-digit number is already a SteamID64.
  if (/^\d{17}$/.test(s)) return s;

  // Otherwise treat it as a vanity name and resolve it.
  const res = await fetch(`${HOST}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(s)}`);
  if (!res.ok) throw new Error(`Steam ResolveVanityURL failed: ${res.status}`);
  const json = (await res.json()) as { response?: { success?: number; steamid?: string } };
  return json.response?.success === 1 && json.response.steamid ? json.response.steamid : null;
}

export async function getOwnedGames(steamId: string): Promise<SteamGame[]> {
  const key = getApiKeys().steamApiKey;
  if (!key) throw new Error('Steam API key not configured');
  const url =
    `${HOST}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam GetOwnedGames failed: ${res.status}`);
  const json = (await res.json()) as { response?: { games?: { appid: number; name?: string }[] } };
  return (json.response?.games ?? [])
    .filter((g) => g.name && g.name.trim())
    .map((g) => ({ appid: g.appid, name: g.name!.trim() }));
}

// Portrait library capsule — looks right in the cover cards (falls back to a
// broken image for the rare app without one; re-enrich via IGDB to fix).
export function steamCoverUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}
