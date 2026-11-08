'use client';

/**
 * MTT global client state (zustand). The Three.js engine and the React UI
 * overlay meet here: the engine writes gameplay state, the UI renders it,
 * UI actions call back into the engine through engineRef actions.
 */
import { create } from 'zustand';
import type {
  ColorId, CupHandle, CupPattern, CupSilhouette, FamiliarId, Layer, LightMood,
  Location, PlaylistId, PuzzleDef, WeatherId,
} from './data';
import type {
  Atmosphere, CupCustom, JournalCard, Progress, QuietDraft, ServiceDraft, Settings,
} from './persist';
import { loadAll, saveAtmosphere, saveCup, saveJournal, saveProgress, saveQuietDraft, saveServiceDraft, saveSettings } from './persist';

export type Screen = 'boot' | 'arrival' | 'center' | 'service' | 'quiet';

export interface Caption { id: number; text: string; kind: 'sound' | 'cue' | 'line' }

export interface GlassView {
  capacity: number;
  layers: Layer[];
}

/** Actions the UI calls; wired to the engine at mount time. */
export interface EngineActions {
  begin: () => void;
  teleport: (loc: Location) => void;
  setScreen: (s: Screen) => void;
  welcomeVisitor: (visitorId: string) => void;
  resumeService: () => void;
  resumeQuiet: () => void;
  startFresh: () => void;
  selectGlass: (index: number) => void;
  pourTo: (index: number) => void;
  undoPuzzle: () => void;
  resetPuzzle: () => void;
  requestHint: () => void;
  addIngredient: (color: ColorId) => void;
  emptyGlass: (index: number) => void;
  focusGlass: (index: number) => void;
  openSaveBlend: () => void;
  commitBlend: (name: string, effect: string, effectId: string, recognized: boolean) => void;
  toggleFavorite: (cardId: string) => void;
  saveVariant: (cardId: string, name: string) => void;
  deleteCard: (cardId: string) => void;
  applyCup: (c: CupCustom) => void;
  pokeFamiliar: () => void;
}

export interface UiState {
  modal: null | 'howto' | 'settings' | 'atmosphere' | 'journal' | 'about' | 'save-blend' | 'cup';
  journalSearch: string;
  journalSort: 'newest' | 'az' | 'favorites';
  saveBlendName: string;
  saveBlendEffect: string;
  saveBlendEffectId: string;
}

export interface MttState {
  booted: boolean;
  engineReady: boolean;
  screen: Screen;
  location: Location;
  // service
  visitorId: string | null;
  servedThisVisit: boolean;
  puzzle: PuzzleDef | null;
  glasses: GlassView[] | null;
  selectedGlass: number | null;
  pourLocked: boolean; // during animation
  // quiet
  quietGlasses: GlassView[] | null;
  quietFocused: number;
  // pending blend (set by engine when Save Blend pressed)
  pendingBlend: { colors: string[]; ingredientNames: string[]; recognized: boolean; authoredName?: string; authoredEffect?: string; authoredEffectId?: string } | null;
  // resume offer at boot
  resumeOffer: { service: boolean; quiet: boolean } | null;
  // persistence-backed slices (mirrored for UI)
  settings: Settings;
  atmosphere: Atmosphere;
  journal: JournalCard[];
  cup: CupCustom;
  progress: Progress;
  // hud
  captions: Caption[];
  toast: string | null;
  ui: UiState;
  actions: EngineActions;
  // internal setters (engine + ui)
  set: (p: Partial<MttState>) => void;
  patchUi: (p: Partial<UiState>) => void;
  pushCaption: (text: string, kind?: Caption['kind']) => void;
  updateSettings: (p: Partial<Settings>) => void;
  updateAtmosphere: (p: Partial<Atmosphere>) => void;
  setJournal: (j: JournalCard[]) => void;
  setCup: (c: CupCustom) => void;
  updateProgress: (p: Partial<Progress>) => void;
  persistServiceDraft: (d: ServiceDraft | null) => void;
  persistQuietDraft: (d: QuietDraft | null) => void;
  showToast: (t: string | null) => void;
}

const loaded = typeof window !== 'undefined' ? loadAll() : ({} as ReturnType<typeof loadAll>);

export const DEFAULT_SETTINGS: Settings = {
  master: 0.9, music: 0.55, weatherVol: 0.5, ambience: 0.4, sfx: 0.8,
  muted: false, reducedMotion: false, captions: true, alwaysSymbols: true,
  familiar: 'cat',
};

export const DEFAULT_ATMOSPHERE: Atmosphere = { light: 'golden', weather: 'clear', playlist: 'silence' };

export const DEFAULT_CUP: CupCustom = { silhouette: 'round', bodyHex: '#e8a34d', pattern: 'stripes', handle: 'loop' };

export const DEFAULT_PROGRESS: Progress = {
  seenIntro: false, servedVisitors: [], earnedCups: [], puzzleCursor: 0,
};

let captionId = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useMtt = create<MttState>((set, get) => ({
  booted: false,
  engineReady: false,
  screen: 'boot',
  location: 'center',
  visitorId: null,
  servedThisVisit: false,
  puzzle: null,
  glasses: null,
  selectedGlass: null,
  pourLocked: false,
  quietGlasses: null,
  quietFocused: 0,
  pendingBlend: null,
  resumeOffer: null,
  settings: { ...DEFAULT_SETTINGS, ...(loaded.settings ?? {}) },
  atmosphere: { ...DEFAULT_ATMOSPHERE, ...(loaded.atmosphere ?? {}) },
  journal: loaded.journal ?? [],
  cup: { ...DEFAULT_CUP, ...(loaded.cup ?? {}) },
  progress: { ...DEFAULT_PROGRESS, ...(loaded.progress ?? {}) },
  captions: [],
  toast: null,
  ui: { modal: null, journalSearch: '', journalSort: 'newest', saveBlendName: '', saveBlendEffect: 'Soft shimmer', saveBlendEffectId: 'shimmer' },
  actions: {
    begin: () => { /* wired by engine */ },
    teleport: () => {},
    setScreen: () => {},
    welcomeVisitor: () => {},
    resumeService: () => {},
    resumeQuiet: () => {},
    startFresh: () => {},
    selectGlass: () => {},
    pourTo: () => {},
    undoPuzzle: () => {},
    resetPuzzle: () => {},
    requestHint: () => {},
    addIngredient: () => {},
    emptyGlass: () => {},
    focusGlass: () => {},
    openSaveBlend: () => {},
    commitBlend: () => {},
    toggleFavorite: () => {},
    saveVariant: () => {},
    deleteCard: () => {},
    applyCup: () => {},
    pokeFamiliar: () => {},
  },
  set: (p) => set(p),
  patchUi: (p) => set((s) => ({ ui: { ...s.ui, ...p } })),
  pushCaption: (text, kind = 'sound') => {
    const id = ++captionId;
    set((s) => ({ captions: [...s.captions.slice(-3), { id, text, kind }] }));
    setTimeout(() => {
      set((s) => ({ captions: s.captions.filter((c) => c.id !== id) }));
    }, 3200);
  },
  updateSettings: (p) => {
    set((s) => {
      const next = { ...s.settings, ...p };
      saveSettings(next);
      return { settings: next };
    });
  },
  updateAtmosphere: (p) => {
    set((s) => {
      const next = { ...s.atmosphere, ...p };
      saveAtmosphere(next);
      return { atmosphere: next };
    });
  },
  setJournal: (j) => {
    set({ journal: j });
    saveJournal(j);
  },
  setCup: (c) => {
    set({ cup: c });
    saveCup(c);
  },
  updateProgress: (p) => {
    set((s) => {
      const next = { ...s.progress, ...p };
      saveProgress(next);
      return { progress: next };
    });
  },
  persistServiceDraft: (d) => {
    saveServiceDraft(d);
    // keep draft state out of the reactive store; resumeOffer computed at boot
    void get();
  },
  persistQuietDraft: (d) => saveQuietDraft(d),
  showToast: (t) => {
    set({ toast: t });
    if (toastTimer) clearTimeout(toastTimer);
    if (t) toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));

export const mtt = useMtt;
