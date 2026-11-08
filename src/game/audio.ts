'use client';

/**
 * MTT audio — the real 40-track music library + procedural beds.
 *
 * Music: the mastered library (source of truth `audio/music/` in the repo
 * root, served to the browser from `public/audio/music/`) — manifest-driven
 * playlists, sequential with continuous repeat, 5 s equal-power crossfade
 * (spec default; finals also carry baked 1.5 s/4 s fades so any cut is
 * seam-free), now-playing captions. Masters play at unity gain on the music
 * bus at their −18 LUFS value — no normalisation, no limiter (spec §Mixer).
 * Prototype wiring allows `mastered_pending_listen_review` so the Director
 * can hear the whole library in context; a shipping build narrows
 * ALLOWED_STATUSES to ['approved'].
 *
 * Weather, interior ambience and functional SFX are still WebAudio-synthesised
 * placeholders (no recorded assets exist for those families yet; brief §9
 * catalog is a production target, not proof of files). Every functional cue
 * has a caption equivalent.
 *
 * Buses: master → { music, weather, ambience, sfx }, all independently
 * controllable per brief §9.
 */
import { PLAYLIST_LABELS, type PlaylistId, type WeatherId } from './data';
import type { Settings } from './persist';

type CaptionFn = (text: string, kind?: 'sound' | 'cue' | 'line') => void;

const ASSET_BASE = '/audio/music'; // public/audio/music mirrors <repo>/audio/music
const ALLOWED_STATUSES = ['approved', 'mastered_pending_listen_review'];
const CROSSFADE_S = 5; // spec §Player: adjustable 3–8 s, default 5
const SWITCH_FADE_S = 2.2; // playlist switch / fade-to-silence
const MAX_CACHED_BUFFERS = 3; // decoded PCM ≈ 70 MB per 180 s track — keep neighbours only

interface ManifestTrack {
  id: string;
  title: string;
  mood: string;
  file: string; // e.g. 'audio/music/finals/R01_lanterns_against_the_rain.ogg'
  status: string;
  duration_s?: number;
}

interface ManifestJson {
  playlists: Record<string, string[]>;
  tracks: ManifestTrack[];
}

// equal-power crossfade curves (sin/cos ramps), per docs/audio-playback-spec.md
const CURVE_STEPS = 32;
const CURVE_UP = Float32Array.from({ length: CURVE_STEPS + 1 }, (_, i) => Math.sin((i / CURVE_STEPS) * Math.PI / 2));
const CURVE_DOWN = Float32Array.from({ length: CURVE_STEPS + 1 }, (_, i) => Math.cos((i / CURVE_STEPS) * Math.PI / 2));

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses: Record<'music' | 'weather' | 'ambience' | 'sfx', GainNode> = {} as never;

  // ---- music library state ----
  private musicCross: { a: GainNode | null; b: GainNode | null } = { a: null, b: null };
  private playlist: PlaylistId = 'silence';
  private tracksById = new Map<string, ManifestTrack>();
  private order = new Map<string, string[]>(); // mood ("Rainy Twilight") → track ids
  private queue: ManifestTrack[] = [];
  private queuePos = 0;
  private nowPlaying: ManifestTrack | null = null;
  private manifestReady = false;
  private generation = 0; // bumps on every playlist change; stale async work gives up
  private trackTimer: ReturnType<typeof setTimeout> | null = null;
  private liveSources = new Set<AudioBufferSourceNode>();
  private buffers = new Map<string, AudioBuffer>(); // LRU: file → decoded
  private pending = new Map<string, Promise<AudioBuffer>>();

  // ---- weather / ambience placeholder state ----
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private snowSrc: AudioBufferSourceNode | null = null;
  private snowGain: GainNode | null = null;
  private ambienceSrc: AudioBufferSourceNode | null = null;

  private settings: Settings | null = null;
  private caption: CaptionFn = () => {};
  private started = false;

  init(settings: Settings, caption: CaptionFn) {
    this.settings = settings;
    this.caption = caption;
    if (this.started) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    (['music', 'weather', 'ambience', 'sfx'] as const).forEach((k) => {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[k] = g;
    });
    this.started = true;
    this.applySettings(settings);
    this.setWeather('clear', true);
    this.setPlaylist(this.playlist, true);
    void this.loadManifest();
  }

  resume() {
    void this.ctx?.resume();
  }

  /** QC helper — read from the console via `mttAudio.debugState`. */
  get debugState() {
    return {
      ctx: this.ctx?.state ?? 'none',
      playlist: this.playlist,
      manifestReady: this.manifestReady,
      nowPlaying: this.nowPlaying?.title ?? null,
      queuePos: this.queuePos,
      queueLength: this.queue.length,
      decodedBuffers: this.buffers.size,
    };
  }

  private async loadManifest() {
    try {
      const res = await fetch(`${ASSET_BASE}/manifest.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const m = (await res.json()) as ManifestJson;
      m.tracks.forEach((t) => this.tracksById.set(t.id, t));
      Object.entries(m.playlists).forEach(([mood, ids]) => this.order.set(mood, ids));
      this.manifestReady = true;
      // a playlist may have been requested before the manifest arrived — start it now
      if (this.playlist !== 'silence') {
        this.generation++;
        void this.enterPlaylist(this.playlist as Exclude<PlaylistId, 'silence'>, this.generation, true);
      }
    } catch {
      this.caption('[music library unavailable — the tent stays quiet]', 'cue');
    }
  }

  applySettings(s: Settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(s.muted ? 0 : s.master, t + 0.15);
    this.buses.music.gain.linearRampToValueAtTime(s.music, t + 0.2);
    this.buses.weather.gain.linearRampToValueAtTime(s.weatherVol, t + 0.2);
    this.buses.ambience.gain.linearRampToValueAtTime(s.ambience, t + 0.2);
    this.buses.sfx.gain.linearRampToValueAtTime(s.sfx, t + 0.2);
  }

  // ---------- music: the real library ----------

  setPlaylist(id: PlaylistId, instant = false) {
    const prev = this.playlist;
    this.playlist = id;
    if (!this.ctx) return;
    if (prev !== id) {
      this.caption(id === 'silence' ? '[music fades to silence]' : `[music: ${PLAYLIST_LABELS[id]}]`);
    }
    // re-applying the playlist that is already playing must not restart the track
    if (prev === id && id !== 'silence' && this.queue.length > 0) return;
    this.generation++;
    const gen = this.generation;
    this.clearTrackTimer();
    this.fadeOutSlot(this.musicCross.a, instant ? 0.05 : SWITCH_FADE_S);
    this.stopSourcesAfter(instant ? 0.1 : SWITCH_FADE_S + 0.2);
    this.musicCross.a = null;
    this.musicCross.b = null;
    if (id === 'silence') {
      this.nowPlaying = null;
      this.queue = [];
      return;
    }
    if (!this.manifestReady) return; // loadManifest() picks this up when it lands
    void this.enterPlaylist(id as Exclude<PlaylistId, 'silence'>, gen, instant);
  }

  private buildQueue(id: Exclude<PlaylistId, 'silence'>): ManifestTrack[] {
    const mood = PLAYLIST_LABELS[id];
    return (this.order.get(mood) ?? [])
      .map((tid) => this.tracksById.get(tid))
      .filter((t): t is ManifestTrack => !!t && ALLOWED_STATUSES.includes(t.status));
  }

  private async enterPlaylist(id: Exclude<PlaylistId, 'silence'>, gen: number, instant: boolean) {
    const queue = this.buildQueue(id);
    if (gen !== this.generation) return;
    if (!queue.length) {
      this.caption('[no approved tracks for this mood yet]', 'cue');
      return;
    }
    this.queue = queue;
    this.queuePos = 0;
    await this.startTrack(queue[0], gen, instant);
  }

  private async startTrack(track: ManifestTrack, gen: number, instant: boolean) {
    if (!this.ctx || gen !== this.generation) return;
    let buffer: AudioBuffer;
    try {
      buffer = await this.getBuffer(track.file);
    } catch {
      if (gen === this.generation) {
        this.caption('[a track slipped away — skipping]', 'cue');
        this.advance(gen);
      }
      return;
    }
    if (!this.ctx || gen !== this.generation) return;
    const ctx = this.ctx;
    const slot = ctx.createGain();
    slot.gain.value = 0;
    slot.connect(this.buses.music);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(slot);

    const t0 = ctx.currentTime;
    const fade = instant ? 0.15 : CROSSFADE_S;
    // equal-power crossfade: the new slot rises while the old one falls
    const old = this.musicCross.a;
    this.musicCross.a = slot;
    this.musicCross.b = old;
    slot.gain.setValueCurveAtTime(CURVE_UP, t0, fade);
    if (old) {
      old.gain.cancelScheduledValues(t0);
      old.gain.setValueCurveAtTime(CURVE_DOWN, t0, fade);
      window.setTimeout(() => { try { old.disconnect(); } catch { /* already gone */ } }, (fade + 0.4) * 1000);
    }
    this.liveSources.add(src);
    src.onended = () => {
      this.liveSources.delete(src);
      try { slot.disconnect(); } catch { /* already gone */ }
    };
    src.start(t0);
    // finals carry a baked 4 s fade-out; the slot is fully down before this hard stop
    src.stop(t0 + buffer.duration + 0.2);

    this.nowPlaying = track;
    this.caption(`♪ ${track.title}`, 'cue');

    // schedule the crossfade into the next track just before this one ends
    const remainMs = Math.max(1, (buffer.duration - fade - 0.05) * 1000);
    this.trackTimer = setTimeout(() => {
      if (gen === this.generation) this.advance(gen);
    }, remainMs);

    // prefetch the next buffer so the crossfade is seamless
    const next = this.queue[(this.queuePos + 1) % this.queue.length];
    if (next) void this.getBuffer(next.file).catch(() => { /* fetched again on demand */ });
  }

  private advance(gen: number) {
    if (gen !== this.generation || !this.queue.length || !this.ctx) return;
    this.queuePos = (this.queuePos + 1) % this.queue.length;
    void this.startTrack(this.queue[this.queuePos], gen, false);
  }

  private fadeOutSlot(slot: GainNode | null, fade: number) {
    if (!slot || !this.ctx || fade <= 0) return;
    const t = this.ctx.currentTime;
    slot.gain.cancelScheduledValues(t);
    try { slot.gain.setValueCurveAtTime(CURVE_DOWN, t, fade); } catch { /* curve overlap — let it be */ }
    window.setTimeout(() => { try { slot.disconnect(); } catch { /* already gone */ } }, (fade + 0.4) * 1000);
  }

  private stopSourcesAfter(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + seconds;
    this.liveSources.forEach((s) => { try { s.stop(t); } catch { /* already stopped */ } });
  }

  private clearTrackTimer() {
    if (this.trackTimer) { clearTimeout(this.trackTimer); this.trackTimer = null; }
  }

  private async getBuffer(file: string): Promise<AudioBuffer> {
    const hit = this.buffers.get(file);
    if (hit) {
      this.buffers.delete(file);
      this.buffers.set(file, hit); // refresh LRU position
      return hit;
    }
    const inflight = this.pending.get(file);
    if (inflight) return inflight;
    const p = (async () => {
      const url = `/${file.replace(/^\/+/, '')}`; // manifest paths start with 'audio/music/'
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx!.decodeAudioData(arr);
      this.buffers.set(file, buf);
      while (this.buffers.size > MAX_CACHED_BUFFERS) {
        const oldest = this.buffers.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        if (oldest === file) break; // never evict what we just added
        this.buffers.delete(oldest);
      }
      return buf;
    })().finally(() => { this.pending.delete(file); });
    this.pending.set(file, p);
    return p;
  }

  // ---------- weather / ambience beds (procedural placeholders) ----------

  private noiseBuffer(seconds = 2, brown = false): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w;
    }
    return buf;
  }

  setWeather(w: WeatherId, instant = false) {
    if (!this.ctx) return;
    if (w === 'rain') this.caption('[rain pattering softly]');
    if (w === 'snow') this.caption('[a hush of snowfall]');
    if (w === 'clear') this.caption('[the sky settles]');
    const fade = instant ? 0.1 : 2.0;
    const t = this.ctx.currentTime;
    if (w === 'rain') {
      if (!this.rainSrc) {
        this.rainSrc = this.ctx.createBufferSource();
        this.rainSrc.buffer = this.noiseBuffer(3, false);
        this.rainSrc.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0;
        this.rainSrc.connect(f); f.connect(this.rainGain); this.rainGain.connect(this.buses.weather);
        this.rainSrc.start();
      }
      this.rainGain!.gain.cancelScheduledValues(t);
      this.rainGain!.gain.linearRampToValueAtTime(0.16, t + fade);
    } else if (this.rainGain) {
      this.rainGain.gain.linearRampToValueAtTime(0, t + fade);
    }
    if (w === 'snow') {
      if (!this.snowSrc) {
        this.snowSrc = this.ctx.createBufferSource();
        this.snowSrc.buffer = this.noiseBuffer(3, true);
        this.snowSrc.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 320;
        this.snowGain = this.ctx.createGain();
        this.snowGain.gain.value = 0;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.13;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain); lfoGain.connect(this.snowGain.gain);
        lfo.start();
        this.snowSrc.connect(f); f.connect(this.snowGain); this.snowGain.connect(this.buses.weather);
        this.snowSrc.start();
      }
      this.snowGain!.gain.cancelScheduledValues(t);
      this.snowGain!.gain.linearRampToValueAtTime(0.1, t + fade);
    } else if (this.snowGain) {
      this.snowGain.gain.linearRampToValueAtTime(0, t + fade);
    }
  }

  startAmbience() {
    if (!this.ctx || this.ambienceSrc) return;
    this.ambienceSrc = this.ctx.createBufferSource();
    this.ambienceSrc.buffer = this.noiseBuffer(4, true);
    this.ambienceSrc.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    this.ambienceSrc.connect(f); f.connect(g); g.connect(this.buses.ambience);
    this.ambienceSrc.start();
    this.caption('[quiet room tone]');
  }

  // ---------- sfx (procedural placeholders; every one has a caption) ----------

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.buses.sfx);
    o.start(t); o.stop(t + dur + 0.1);
  }

  private noiseBurst(dur: number, freq: number, vol: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.buses.sfx);
    src.start(t); src.stop(t + dur + 0.05);
  }

  uiClick() { this.tone(660, 0.1, 'sine', 0.05); }

  teleport() { this.caption('[soft step]'); this.noiseBurst(0.35, 500, 0.05); this.tone(520, 0.3, 'sine', 0.03, 0.05); }

  shimmer() { this.caption('[a gentle shimmer]'); [880, 1174, 1567].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.045, i * 0.12)); }

  pour() { this.caption('[tea pours]'); this.noiseBurst(0.5, 900, 0.09); }

  settle() { this.caption('[layers settle]'); this.tone(240, 0.25, 'sine', 0.05); }

  invalid(reason: string) { this.caption(reason, 'cue'); this.tone(196, 0.28, 'sine', 0.035); }

  select() { this.tone(740, 0.14, 'sine', 0.04); }

  success() {
    this.caption('[a small bloom of light]');
    [523, 659, 784].forEach((f, i) => this.tone(f, 1.1, 'sine', 0.06, i * 0.14));
  }

  cupReveal() {
    this.caption('[the cup gleams]');
    [784, 988, 1175].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.055, i * 0.16));
    this.tone(392, 1.8, 'triangle', 0.03, 0.1);
  }

  journalOpen() { this.caption('[pages whisper]'); this.noiseBurst(0.4, 2400, 0.03); }

  saveChime() { this.caption('[saved]'); this.tone(880, 0.5, 'sine', 0.05); this.tone(1318, 0.6, 'sine', 0.04, 0.1); }

  familiar() { this.tone(988, 0.2, 'sine', 0.04); }

  dispose() {
    this.generation++;
    this.clearTrackTimer();
    this.stopSourcesAfter(0.05);
    try { this.rainSrc?.stop(); this.snowSrc?.stop(); this.ambienceSrc?.stop(); } catch { /* noop */ }
    this.buffers.clear();
    this.pending.clear();
    this.queue = [];
    this.nowPlaying = null;
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}

export const audio = new AudioEngine();

// QC handle for browser testing: `mttAudio.debugState` in the devtools console
if (typeof window !== 'undefined') {
  (window as unknown as { mttAudio?: AudioEngine }).mttAudio = audio;
}
