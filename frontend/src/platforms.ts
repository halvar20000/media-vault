import { TYPE_META, type MediaType } from './types';

// Authentic-ish platform/format colours so the shelf reads like real
// platform-coloured spines (PlayStation blue, Xbox green, Nintendo red…).
const C = {
  playstation: '#1C4F9C',
  xbox: '#107C10',
  nintendo: '#C4162A',
  sega: '#0098A6',
  pc: '#2A2E37',
  bluray: '#123FA6',
  uhd: '#0C0C0C',
  dvd: '#39393B',
  vhs: '#5A4632',
  vinyl: '#C8681E',
  single: '#A24E8F',
  cd: '#2E9B9B',
} as const;

export interface PlatformBadge {
  code: string;
  color: string;
}

// normalized-format → [display code, colour]. Order matters (specific first).
const RULES: [RegExp, string, string][] = [
  [/^ps5|playstation5/, 'PS5', C.playstation],
  [/^ps4|playstation4/, 'PS4', C.playstation],
  [/^ps3|playstation3/, 'PS3', C.playstation],
  [/^ps2|playstation2/, 'PS2', C.playstation],
  [/psvita|vita/, 'VITA', C.playstation],
  [/psp/, 'PSP', C.playstation],
  [/^ps1|psx|playstation1|^playstation$/, 'PS1', C.playstation],
  [/xbox360|x360/, 'X360', C.xbox],
  [/xboxseries|seriesx|seriess|xsx|xss/, 'SERIES', C.xbox],
  [/xboxone|xbone|xone/, 'XB ONE', C.xbox],
  [/xbox/, 'XBOX', C.xbox],
  [/switch2/, 'SW 2', C.nintendo],
  [/switch/, 'SWITCH', C.nintendo],
  [/wiiu/, 'WII U', C.nintendo],
  [/wii/, 'WII', C.nintendo],
  [/n64|nintendo64/, 'N64', C.nintendo],
  [/gamecube|ngc|gcn/, 'GC', C.nintendo],
  [/3ds/, '3DS', C.nintendo],
  [/nintendods|^nds|^ds$/, 'DS', C.nintendo],
  [/gba|gameboyadvance/, 'GBA', C.nintendo],
  [/gameboycolor|gbc/, 'GBC', C.nintendo],
  [/gameboy|^gb$/, 'GB', C.nintendo],
  [/snes|superfamicom|supernintendo/, 'SNES', C.nintendo],
  [/nes|famicom/, 'NES', C.nintendo],
  [/megadrive|genesis|dreamcast|saturn|segacd|gamegear|mastersystem|sega/, 'SEGA', C.sega],
  [/windows|steam|linux|^mac|^pc/, 'PC', C.pc],
  // movies
  [/4k|uhd|ultrahd/, '4K UHD', C.uhd],
  [/bluray3d|3dbluray/, 'BD 3D', C.bluray],
  [/bluray|^bd$/, 'BLU-RAY', C.bluray],
  [/dvd/, 'DVD', C.dvd],
  [/vhs/, 'VHS', C.vhs],
  // music
  [/2xlp|2lp|doublelp/, '2×LP', C.vinyl],
  [/box|boxset/, 'BOX', C.vinyl],
  [/lp|album|vinyl/, 'LP', C.vinyl],
  [/^7|7inch|7single/, '7″', C.single],
  [/^12|12inch/, '12″', C.single],
  [/^cd/, 'CD', C.cd],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Resolve a spine's platform badge. Falls back to the media-type colour and the
// raw format text (or nothing) when no rule matches.
export function platformBadge(format: string | null, type: MediaType): PlatformBadge {
  const f = (format || '').trim();
  if (f) {
    const n = norm(f);
    for (const [re, code, color] of RULES) {
      if (re.test(n)) return { code, color };
    }
    return { code: f.toUpperCase(), color: TYPE_META[type].color };
  }
  return { code: '', color: TYPE_META[type].color };
}
