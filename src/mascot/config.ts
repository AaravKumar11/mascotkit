export const SHAPES = ['blob', 'sphere', 'cube', 'pill', 'triangle', 'egg', 'drop', 'cloud', 'ghost', 'sun', 'lamp', 'coin'] as const;
export const ANIMALS = ['pig', 'cat', 'bear', 'bunny', 'frog', 'chick', 'monster'] as const;
export const SPECIES = [...SHAPES, ...ANIMALS] as const;
export const MOODS = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'sleepy',
  'squinted',
  'calm',
  'inspecting',
  'confused',
] as const;
export const ACCESSORIES = ['none', 'sprout', 'antenna', 'crown', 'cap', 'bow', 'coin', 'halo'] as const;
export const BACKGROUNDS = ['none', 'circle', 'squircle'] as const;
export const NOSES = ['none', 'button', 'triangle', 'snout', 'muzzle', 'beak'] as const;
export const OUTLINES = ['none', 'thin', 'thick'] as const;
export const MOTIONS = ['blink', 'bounce', 'nod', 'sway', 'follow'] as const;

export type Species = (typeof SPECIES)[number];
export type Mood = (typeof MOODS)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Nose = (typeof NOSES)[number];
export type Outline = (typeof OUTLINES)[number];
export type MotionName = (typeof MOTIONS)[number];
export type Motion = Record<MotionName, boolean>;

export interface MascotConfig {
  species: Species;
  mood: Mood | 'auto';
  accessory: Accessory;
  background: Background;
  color: string;
  accent: string;
  ink: string;
  bgColor: string;
  cheeks: boolean;
  mouth: boolean;
  nose: Nose;
  outline: Outline;
  /** Overall size. */
  scale: number;
  /** Body proportions, as multipliers. */
  width: number;
  height: number;
  depth: number;
  /** Moves the eyes up (positive) or down. */
  eyeY: number;
  /** Eye size and spacing, as multipliers. */
  eyeSize: number;
  eyeGap: number;
}

/** Allowed range for every number in the config. */
export const RANGES = {
  scale: [0.6, 1.3],
  width: [0.6, 1.5],
  height: [0.6, 1.5],
  depth: [0.5, 1.5],
  eyeY: [-0.3, 0.3],
  eyeSize: [0.5, 1.8],
  eyeGap: [0.5, 1.6],
} as const satisfies Record<string, readonly [number, number]>;

export type NumberField = keyof typeof RANGES;

export const DEFAULT_CONFIG: MascotConfig = {
  species: 'blob',
  mood: 'happy',
  accessory: 'sprout',
  background: 'circle',
  color: '#7ee0b8',
  accent: '#2f9e7a',
  ink: '#1b1d2b',
  bgColor: '#e9fbf3',
  cheeks: false,
  mouth: false,
  nose: 'none',
  outline: 'none',
  scale: 1,
  width: 1,
  height: 1,
  depth: 1,
  eyeY: 0,
  eyeSize: 1,
  eyeGap: 1,
};

export const NO_MOTION: Motion = { blink: false, bounce: false, nod: false, sway: false, follow: false };

export interface Palette {
  name: string;
  color: string;
  accent: string;
  bgColor: string;
}

export const PALETTES: Palette[] = [
  { name: 'Mint', color: '#7ee0b8', accent: '#2f9e7a', bgColor: '#e9fbf3' },
  { name: 'Blueberry', color: '#5468e0', accent: '#3346b8', bgColor: '#e6e9ff' },
  { name: 'Terracotta', color: '#e07a5f', accent: '#b5523a', bgColor: '#fdebe5' },
  { name: 'Lemon', color: '#f7d23e', accent: '#e0a21f', bgColor: '#fff7d6' },
  { name: 'Teal', color: '#4fb8b3', accent: '#2e8a86', bgColor: '#e2f6f5' },
  { name: 'Tangerine', color: '#e38b4f', accent: '#b8642c', bgColor: '#fdeee2' },
  { name: 'Bubblegum', color: '#f7a8d8', accent: '#e070b4', bgColor: '#fdeaf5' },
  { name: 'Cherry', color: '#dc4a55', accent: '#a8303a', bgColor: '#fde6e8' },
  { name: 'Lilac', color: '#d5dcf2', accent: '#9aa6d6', bgColor: '#f1f3fb' },
  { name: 'Fog', color: '#cfcfd4', accent: '#9a9aa3', bgColor: '#f0f0f3' },
  { name: 'Piggy', color: '#f7c5cf', accent: '#e58fa3', bgColor: '#fdeef1' },
  { name: 'Grape', color: '#b69cff', accent: '#6b4fd8', bgColor: '#f0ebff' },
  { name: 'Honey', color: '#d9a66c', accent: '#8a5a2b', bgColor: '#f8efe4' },
  { name: 'Frog', color: '#9bd96a', accent: '#4f9a2e', bgColor: '#eefbe4' },
  { name: 'Gold', color: '#f2bd3a', accent: '#b9850f', bgColor: '#fff5d6' },
  { name: 'Midnight', color: '#1b1b1f', accent: '#4a4a55', bgColor: '#e7e7ec' },
];

/** The palette each species starts with when you pick it in the studio. */
export const SPECIES_PALETTE: Record<Species, string> = {
  blob: 'Mint',
  sphere: 'Blueberry',
  cube: 'Cherry',
  pill: 'Teal',
  triangle: 'Tangerine',
  egg: 'Lemon',
  drop: 'Blueberry',
  cloud: 'Fog',
  ghost: 'Lilac',
  sun: 'Tangerine',
  lamp: 'Teal',
  coin: 'Gold',
  pig: 'Piggy',
  cat: 'Lemon',
  bear: 'Honey',
  bunny: 'Grape',
  frog: 'Frog',
  chick: 'Lemon',
  monster: 'Blueberry',
};

/** The nose each animal comes with. Shapes start with none. */
export const SPECIES_NOSE: Partial<Record<Species, Nose>> = {
  pig: 'snout',
  cat: 'triangle',
  bear: 'muzzle',
  bunny: 'button',
  chick: 'beak',
};

export const isAnimal = (s: Species) => (ANIMALS as readonly string[]).includes(s);

/** What a species starts with when you pick it: shapes get just eyes, animals get their face. */
export function speciesDefaults(species: Species): Partial<MascotConfig> {
  const p = paletteFor(species);
  const animal = isAnimal(species);
  return {
    species,
    color: p.color,
    accent: p.accent,
    bgColor: p.bgColor,
    ink: inkFor(p.color),
    nose: SPECIES_NOSE[species] ?? 'none',
    mouth: animal && species !== 'chick',
    cheeks: animal,
  };
}

/** Ink that reads on dark bodies. */
export const inkFor = (color: string) => (luminance(color) < 0.25 ? '#ffffff' : '#1b1d2b');

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const HEX = /^#[0-9a-f]{6}$/i;

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

/** Turns untrusted input (URL params, AI output, JSON) into a complete, safe config. */
export function sanitizeConfig(input: Record<string, unknown> = {}): MascotConfig {
  const c: MascotConfig = { ...DEFAULT_CONFIG };
  if (oneOf(SPECIES, input.species)) c.species = input.species;
  if (input.mood === 'auto' || oneOf(MOODS, input.mood)) c.mood = input.mood;
  if (oneOf(ACCESSORIES, input.accessory)) c.accessory = input.accessory;
  if (oneOf(BACKGROUNDS, input.background)) c.background = input.background;
  for (const k of ['color', 'accent', 'ink', 'bgColor'] as const) {
    const v = input[k];
    if (typeof v === 'string' && HEX.test(v)) c[k] = v.toLowerCase();
  }
  if (oneOf(NOSES, input.nose)) c.nose = input.nose;
  if (oneOf(OUTLINES, input.outline)) c.outline = input.outline;
  for (const k of ['cheeks', 'mouth'] as const) {
    const v = input[k];
    if (typeof v === 'boolean') c[k] = v;
    else if (v === '1' || v === '0') c[k] = v === '1';
  }
  for (const k of Object.keys(RANGES) as NumberField[]) {
    const v = typeof input[k] === 'string' ? Number(input[k]) : input[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const [lo, hi] = RANGES[k];
      c[k] = Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100;
    }
  }
  return c;
}

export const paletteFor = (species: Species) => PALETTES.find((p) => p.name === SPECIES_PALETTE[species])!;

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function randomConfig(): MascotConfig {
  const species = pick(SPECIES);
  const palette = Math.random() < 0.6 ? paletteFor(species) : pick(PALETTES);
  const between = (lo: number, hi: number) => Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
  return {
    ...DEFAULT_CONFIG,
    ...speciesDefaults(species),
    mouth: Math.random() < 0.6,
    outline: pick(OUTLINES),
    width: between(0.85, 1.15),
    height: between(0.85, 1.15),
    eyeSize: between(0.8, 1.3),
    eyeGap: between(0.85, 1.2),
    mood: pick(MOODS),
    accessory: Math.random() < 0.35 ? 'none' : pick(ACCESSORIES),
    background: pick(['circle', 'squircle'] as const),
    color: palette.color,
    accent: palette.accent,
    ink: inkFor(palette.color),
    bgColor: palette.bgColor,
    cheeks: Math.random() < 0.6,
  };
}
