/**
 * MTT — Magical Tea Tent, prototype data layer.
 * Everything here is data-driven on purpose (brief §12): new puzzles,
 * recipes or moods should not require rewriting scene logic.
 */

// ---------- Tea colors / ingredients ----------

export type ColorId = 'amber' | 'rose' | 'teal' | 'honey' | 'bluebell' | 'mint' | 'cream';

export interface TeaColorDef {
  id: ColorId;
  name: string;
  hex: string;
  /** Drawn glyph id (rendered as inline SVG + canvas stamps). Non-color order cue. */
  glyph: 'sun' | 'flower' | 'star' | 'drop' | 'bell' | 'leaf' | 'circle';
}

export const TEA_COLORS: Record<ColorId, TeaColorDef> = {
  amber:    { id: 'amber',    name: 'Amber Honey', hex: '#e8a34d', glyph: 'sun' },
  rose:     { id: 'rose',     name: 'Rose Petal',  hex: '#e86a8a', glyph: 'flower' },
  teal:     { id: 'teal',     name: 'Teal Leaf',   hex: '#3fa8a0', glyph: 'star' },
  honey:    { id: 'honey',    name: 'Resting Honey', hex: '#c97b2d', glyph: 'drop' },
  bluebell: { id: 'bluebell', name: 'Bluebell',    hex: '#8f96e0', glyph: 'bell' },
  mint:     { id: 'mint',     name: 'Fresh Mint',  hex: '#7fc98f', glyph: 'leaf' },
  cream:    { id: 'cream',    name: 'Moon Milk',   hex: '#f3e7d3', glyph: 'circle' },
};

/** Colors the puzzle system uses. Honey is reserved for the constraint puzzle. */
export const SERVICE_COLORS: ColorId[] = ['amber', 'rose', 'teal', 'honey'];
export const QUIET_INGREDIENTS: ColorId[] = ['amber', 'rose', 'bluebell', 'mint', 'cream'];

// ---------- Layers / glasses / puzzle definitions ----------

export interface Layer { color: ColorId; locked?: boolean }
export interface GlassDef { layers: Layer[]; capacity: number }
export interface PuzzleSnapshot { glasses: GlassDef[] }

export type WinRuleType = 'sorted-vessels' | 'target-stack' | 'constraint';
/** Legal pour transitions are per-puzzle (brief §5.2): classic water-sort,
 *  or free layered pours where liquid settles in pour order (teaches plate reading). */
export type PourRule = 'same-or-empty' | 'free';

export interface PuzzleDef {
  id: string;
  name: string;
  ruleType: WinRuleType;
  pourRule: PourRule;
  glasses: GlassDef[];
  /** For target-stack: which glass must end in this exact bottom→top order. */
  targetIndex?: number;
  targetOrder?: ColorId[];
  /** For constraint: this glass may never be poured from. */
  lockedGlass?: number;
  hint: string;
  /** Recipe id of the ornate reward cup earned on success. */
  rewardRecipe: string;
  teachLine: string;
}

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'first-steep',
    name: 'First Steep',
    ruleType: 'sorted-vessels',
    pourRule: 'same-or-empty',
    glasses: [
      { capacity: 2, layers: [{ color: 'amber' }, { color: 'rose' }] },
      { capacity: 2, layers: [{ color: 'rose' }, { color: 'amber' }] },
      { capacity: 2, layers: [] },
    ],
    hint: 'Pour one layer at a time — onto the same color, or into an empty glass. When every glass holds a single color, the tea is ready.',
    rewardRecipe: 'rc-amber-rose',
    teachLine: 'A gentle beginning: two colors have tumbled together. Sort them apart.',
  },
  {
    id: 'layered-grace',
    name: 'Layered Grace',
    ruleType: 'target-stack',
    pourRule: 'free',
    targetIndex: 0,
    targetOrder: ['amber', 'rose', 'teal'],
    glasses: [
      { capacity: 3, layers: [{ color: 'amber' }] },
      { capacity: 3, layers: [{ color: 'teal' }, { color: 'rose' }] },
      { capacity: 3, layers: [{ color: 'rose' }, { color: 'amber' }] },
    ],
    hint: 'Read the plate from its widest ring to the smallest — that is bottom to top. Here you may pour onto any color; the layers settle in the order you pour them.',
    rewardRecipe: 'rc-grace',
    teachLine: 'This visitor sent a plate with stacked rings. Pour gently, in order — the layers will hold.',
  },
  {
    id: 'resting-honey',
    name: 'The Resting Honey',
    ruleType: 'constraint',
    pourRule: 'same-or-empty',
    lockedGlass: 0,
    glasses: [
      { capacity: 2, layers: [{ color: 'honey', locked: true }] },
      { capacity: 2, layers: [{ color: 'teal' }, { color: 'rose' }] },
      { capacity: 2, layers: [{ color: 'rose' }, { color: 'teal' }] },
      { capacity: 2, layers: [] },
    ],
    hint: 'The honey layer is resting and must not be disturbed — its glass cannot be poured from. Sort the remaining two colors.',
    rewardRecipe: 'rc-honey-rest',
    teachLine: 'Some layers simply wish to rest. A special rule: leave the honey be.',
  },
];

// ---------- Reward cups (recipe-specific, not visitor-specific) ----------

export interface RewardRecipeDef {
  id: string;
  name: string;
  /** Gold cup accent + gem colors, derived from the tea combination. */
  accentHex: string;
  gemHex: string;
  silhouette: 'bloom' | 'grace' | 'rest';
  blurb: string;
}

export const REWARD_RECIPES: Record<string, RewardRecipeDef> = {
  'rc-amber-rose': { id: 'rc-amber-rose', name: 'Cup of First Steep', accentHex: '#e8a34d', gemHex: '#e86a8a', silhouette: 'bloom', blurb: 'An amber cup with a rose-set stone.' },
  'rc-grace': { id: 'rc-grace', name: 'Cup of Layered Grace', accentHex: '#3fa8a0', gemHex: '#e8a34d', silhouette: 'grace', blurb: 'A tall cup banded in teal and amber.' },
  'rc-honey-rest': { id: 'rc-honey-rest', name: 'Cup of Resting Honey', accentHex: '#c97b2d', gemHex: '#3fa8a0', silhouette: 'rest', blurb: 'A rounded cup with a drop of honey at its heart.' },
};

// ---------- Quiet Mode authored catalog ----------
// Discoverable by experimenting. Anything not here is "unrecognized" and the
// player names it and picks its shimmer — never framed as a mistake.

export type EffectId = 'starlight' | 'embers' | 'petals' | 'moondust' | 'sparkle' | 'fireflies' | 'shimmer' | 'none';

export interface AuthoredRecipe {
  id: string;
  name: string;
  /** multiset of colors, any order */
  colors: ColorId[];
  effect: EffectId;
  blurb: string;
}

export const AUTHORED_RECIPES: AuthoredRecipe[] = [
  { id: 'twilight-bloom', name: 'Twilight Bloom', colors: ['rose', 'bluebell'], effect: 'starlight', blurb: 'Two garden colors, and suddenly — a night sky.' },
  { id: 'hearthside', name: 'Hearthside', colors: ['amber', 'mint'], effect: 'embers', blurb: 'Warm and green, like a lamp in a hedge.' },
  { id: 'garden-parade', name: 'Garden Parade', colors: ['rose', 'amber', 'mint'], effect: 'petals', blurb: 'The whole garden, marching gently.' },
  { id: 'moonhoney', name: 'Moonhoney', colors: ['bluebell', 'bluebell', 'amber'], effect: 'moondust', blurb: 'Sweet, and slightly lunar.' },
];

export const CHOOSABLE_EFFECTS: EffectId[] = ['sparkle', 'petals', 'fireflies', 'shimmer', 'none'];

export const EFFECT_LABELS: Record<EffectId, string> = {
  starlight: 'Starlight', embers: 'Hearth glow', petals: 'Drifting petals',
  moondust: 'Moondust', sparkle: 'Sparkle', fireflies: 'Fireflies', shimmer: 'Soft shimmer', none: 'No shimmer',
};

// ---------- Visitors & familiars ----------

export type VisitorCategory = 'human' | 'animal' | 'magical';

export interface VisitorDef {
  id: string;
  category: VisitorCategory;
  /** Working label only — identities/names are NOT approved (brief §7). */
  label: string;
  portrait: string | null; // public path, or null = placeholder card
  placeholderNote?: string;
  arrivalLine: string;
  servedLine: string;
}

export const VISITORS: VisitorDef[] = [
  {
    id: 'botanist', category: 'human', label: 'The Botanist (working label)',
    portrait: '/assets/MTT_character_botanist_turnaround_v01.jpg',
    arrivalLine: 'The Botanist arrives, leaves still in her hair.',
    servedLine: 'She wraps both hands around the warm cup and studies it, pleased.',
  },
  {
    id: 'plush-traveler', category: 'animal', label: 'The Plush Traveler (placeholder)',
    portrait: null,
    placeholderNote: 'Star-patterned plush animal — turnaround reported in the Cozy Tea drive; asset not present in this prototype workspace. Placeholder card stands in until the file is confirmed.',
    arrivalLine: 'A small traveler pads in, vest pocket full of crumbs.',
    servedLine: 'They hold the cup with both paws for a long, quiet moment.',
  },
  {
    id: 'lantern-spirit', category: 'magical', label: 'The Lantern Spirit (working label)',
    portrait: '/assets/MTT_visitor_lanternspirit_turnaround_v01.jpg',
    arrivalLine: 'A soft light drifts in — the Lantern Spirit, humming.',
    servedLine: 'Their lantern glows a shade warmer. They settle, content.',
  },
];

export type FamiliarId = 'cat' | 'fox' | 'dog' | 'bird' | 'none';

export const FAMILIARS: { id: FamiliarId; label: string; image: string | null }[] = [
  { id: 'cat', label: 'Marshmallow cat', image: '/assets/MTT_familiar_cat_standalone_v01.jpg' },
  { id: 'fox', label: 'Fox', image: '/assets/MTT_familiar_fox_standalone_v01.jpg' },
  { id: 'dog', label: 'Puppy', image: '/assets/MTT_familiar_dog_standalone_v01.jpg' },
  { id: 'bird', label: 'Little bird', image: '/assets/MTT_familiar_bird_standalone_v01.jpg' },
  { id: 'none', label: 'No familiar', image: null },
];

export const FAMILIAR_BLIPS: Record<Exclude<FamiliarId, 'none'>, string> = {
  cat: 'The cat blinks at you, slowly, and resumes dreaming.',
  fox: 'The fox’s ear flicks — listening to something far away.',
  dog: 'The puppy sighs, entirely content.',
  bird: 'The bird preens one feather, unhurried.',
};

// ---------- Atmosphere ----------

export type LightMood = 'softday' | 'golden' | 'twilight' | 'starlit' | 'winter';
export type WeatherId = 'clear' | 'rain' | 'snow';
export type PlaylistId = 'silence' | 'rainy' | 'golden' | 'starlit' | 'winter';

export interface MoodDef {
  id: LightMood;
  name: string;
  swatchHex: string;
  /** Sky gradient top/bottom seen through the window. */
  skyTop: string; skyBottom: string;
  ambientHex: string; ambientIntensity: number;
  sunHex: string; sunIntensity: number; sunPos: [number, number, number];
  lanternHex: string; lanternIntensity: number;
  fogHex: string; fogDensity: number;
  night: boolean;
}

export const MOODS: Record<LightMood, MoodDef> = {
  softday: {
    id: 'softday', name: 'Soft Morning', swatchHex: '#ffe9c4',
    skyTop: '#bfe3d8', skyBottom: '#fdf0cf',
    ambientHex: '#fff2dd', ambientIntensity: 1.05,
    sunHex: '#ffedc9', sunIntensity: 1.5, sunPos: [3, 6, 2],
    lanternHex: '#ffc985', lanternIntensity: 0.5,
    fogHex: '#f4e6cc', fogDensity: 0.028, night: false,
  },
  golden: {
    id: 'golden', name: 'Golden Garden', swatchHex: '#f7c56e',
    skyTop: '#f2b46a', skyBottom: '#fbe3b0',
    ambientHex: '#ffdfa8', ambientIntensity: 0.95,
    sunHex: '#ffb85c', sunIntensity: 1.9, sunPos: [4, 3, 3],
    lanternHex: '#ffc985', lanternIntensity: 0.7,
    fogHex: '#edcaa0', fogDensity: 0.032, night: false,
  },
  twilight: {
    id: 'twilight', name: 'Rainy Twilight', swatchHex: '#b48ec7',
    skyTop: '#6f5b93', skyBottom: '#c9899b',
    ambientHex: '#d9c3e8', ambientIntensity: 0.8,
    sunHex: '#c9a7d8', sunIntensity: 0.7, sunPos: [-4, 3, -2],
    lanternHex: '#ffc078', lanternIntensity: 1.35,
    fogHex: '#8f7799', fogDensity: 0.042, night: true,
  },
  starlit: {
    id: 'starlit', name: 'Starlit Night', swatchHex: '#5c6fae',
    skyTop: '#1d2447', skyBottom: '#3d4a7a',
    ambientHex: '#b9c3e8', ambientIntensity: 0.62,
    sunHex: '#9fb0e8', sunIntensity: 0.45, sunPos: [-3, 5, -3],
    lanternHex: '#ffbf74', lanternIntensity: 1.5,
    fogHex: '#2c3357', fogDensity: 0.05, night: true,
  },
  winter: {
    id: 'winter', name: 'Winter Refuge', swatchHex: '#cfe0e8',
    skyTop: '#a8c3cf', skyBottom: '#e9f1f2',
    ambientHex: '#e8f0f4', ambientIntensity: 0.95,
    sunHex: '#eaf4ff', sunIntensity: 1.2, sunPos: [2, 7, 3],
    lanternHex: '#ffc985', lanternIntensity: 1.0,
    fogHex: '#d5e2e8', fogDensity: 0.036, night: false,
  },
};

export const LIGHT_MOOD_ORDER: LightMood[] = ['softday', 'golden', 'twilight', 'starlit', 'winter'];

export const PLAYLIST_LABELS: Record<PlaylistId, string> = {
  silence: 'Silence', rainy: 'Rainy Twilight', golden: 'Golden Garden',
  starlit: 'Starlit Night', winter: 'Winter Refuge',
};

export const WEATHER_LABELS: Record<WeatherId, string> = {
  clear: 'Clear', rain: 'Rain', snow: 'Snowfall',
};

// ---------- Personal cup customization ----------

export type CupSilhouette = 'round' | 'tall' | 'tulip';
export type CupPattern = 'none' | 'stripes' | 'dots' | 'scallop';
export type CupHandle = 'loop' | 'none';

export const CUP_BODY_COLORS = [
  '#e8a34d', '#e86a8a', '#3fa8a0', '#8f96e0', '#7fc98f',
  '#c97b2d', '#f3e7d3', '#b48ec7',
];

// ---------- Locations ----------

export type Location = 'center' | 'counter' | 'nook';
