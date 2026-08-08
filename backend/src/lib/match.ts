// Fuzzy title matching for the bundle checker. Normalizes accents/punctuation
// and compares by token overlap (Jaccard), tolerant of extra words, editions,
// and platform noise.

const STOP = new Set([
  'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'de', 'des', 'du', 'of',
  'and', 'et', 'game', 'jeu', 'video', 'edition', 'hd', 'remastered', 'collection',
  'ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'psp', 'vita', 'xbox', '360', 'one', 'series',
  'wii', 'switch', 'pc', 'nintendo', 'sony', 'pal', 'ntsc',
]);

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical groups
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tokens for Jaccard — drop stopwords + bare numbers/roman (compared separately).
export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t) && !(t in ROMAN));
}

// Sequel numbers in a title (digits or roman numerals).
export function numbersOf(s: string): Set<number> {
  const out = new Set<number>();
  for (const t of normalize(s).split(' ')) {
    if (/^\d+$/.test(t)) out.add(parseInt(t, 10));
    else if (t in ROMAN) out.add(ROMAN[t]);
  }
  return out;
}

function sameNumbers(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

export interface Candidate {
  title: string;
  wishlist: boolean;
  norm: string;
  toks: string[];
  nums: Set<number>;
}

export function buildCandidate(title: string, wishlist: boolean): Candidate {
  return { title, wishlist, norm: normalize(title), toks: tokens(title), nums: numbersOf(title) };
}

// Best collection match for an input title, or null below the threshold.
export function bestMatch(input: string, candidates: Candidate[]): { match: Candidate; score: number } | null {
  const nIn = normalize(input);
  if (!nIn) return null;
  const tIn = tokens(input);
  const numsIn = numbersOf(input);
  let best: Candidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.norm === nIn) return { match: c, score: 1 };
    // Different sequel numbers → not the same title ("Top Spin" ≠ "Top Spin 4").
    if ((numsIn.size || c.nums.size) && !sameNumbers(numsIn, c.nums)) continue;
    const sc = jaccard(tIn, c.toks);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best && bestScore >= 0.55 ? { match: best, score: bestScore } : null;
}
