/**
 * MTT persistence — localStorage, no account required (brief §11, PROPOSED
 * MVP technical decision kept for the prototype). Recipe/state/configuration
 * are saved distinctly; assets live in a separate manifest (public/assets).
 */
import type {
  CupHandle, CupPattern, CupSilhouette, FamiliarId, Layer, LightMood,
  PlaylistId, PuzzleSnapshot, WeatherId,
} from './data';

const PREFIX = 'mtt.v1.';

export interface Settings {
  master: number; music: number; weatherVol: number; ambience: number; sfx: number;
  muted: boolean;
  reducedMotion: boolean;
  captions: boolean;
  alwaysSymbols: boolean;
  familiar: FamiliarId;
}

export interface Atmosphere { light: LightMood; weather: WeatherId; playlist: PlaylistId }

export interface JournalCard {
  id: string;
  name: string;
  colors: string[]; // hex list, bottom → top
  ingredientNames: string[];
  effect: string;
  effectId: string;
  recognized: boolean;
  authoredId?: string;
  parentName?: string; // variant of
  favorite: boolean;
  createdAt: number;
  note?: string;
}

export interface CupCustom {
  silhouette: CupSilhouette; bodyHex: string; pattern: CupPattern; handle: CupHandle;
}

export interface Progress {
  seenIntro: boolean;
  servedVisitors: string[];
  earnedCups: string[];
  puzzleCursor: number; // next index into PUZZLES (teaching sequence cycles)
}

export interface ServiceDraft {
  puzzleId: string;
  visitorId: string;
  glasses: { capacity: number; layers: Layer[] }[];
  history: PuzzleSnapshot[];
  startedAt: number;
}

export interface QuietDraft {
  glasses: { capacity: number; layers: Layer[] }[];
  focused: number;
}

export interface SavedAll {
  settings?: Settings;
  atmosphere?: Atmosphere;
  journal?: JournalCard[];
  cup?: CupCustom;
  progress?: Progress;
  serviceDraft?: ServiceDraft | null;
  quietDraft?: QuietDraft | null;
}

function read<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full / private mode — prototype silently keeps memory state
  }
}

export function clearDrafts() {
  write('serviceDraft', null);
  write('quietDraft', null);
}

export const loadAll = (): SavedAll => ({
  settings: read<Settings>('settings'),
  atmosphere: read<Atmosphere>('atmosphere'),
  journal: read<JournalCard[]>('journal'),
  cup: read<CupCustom>('cup'),
  progress: read<Progress>('progress'),
  serviceDraft: read<ServiceDraft | null>('serviceDraft') ?? null,
  quietDraft: read<QuietDraft | null>('quietDraft') ?? null,
});

export const saveSettings = (s: Settings) => write('settings', s);
export const saveAtmosphere = (a: Atmosphere) => write('atmosphere', a);
export const saveJournal = (j: JournalCard[]) => write('journal', j);
export const saveCup = (c: CupCustom) => write('cup', c);
export const saveProgress = (p: Progress) => write('progress', p);
export const saveServiceDraft = (d: ServiceDraft | null) => write('serviceDraft', d);
export const saveQuietDraft = (d: QuietDraft | null) => write('quietDraft', d);
