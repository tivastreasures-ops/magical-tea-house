/**
 * TeaAudioEngine — dependency-free ES module implementing
 * docs/audio-playback-spec.md (magical-tea-house).
 *
 * Buses (separate persisted levels + mutes):
 *   master 0.80 · music 0.60 · weather 0.70 · ambience 0.60 · fx 0.70
 * No normalisation / limiter on the Music bus — masters are −18 LUFS / −2 dBTP.
 *
 * Music: sequential or shuffle within the selected playlist, repeat
 * continuously, optional equal-power crossfade 0–8 s (default 5). Music OFF is
 * first-class: turning it on resumes at the NEXT track start. Weather and
 * interior ambience live on their own buses and never touch the music player.
 *
 * Every functional cue fired through playSfx() also emits onCaption(text) —
 * audio is never the only signal. Captions fire even before audio unlock and
 * while buses are muted.
 *
 * Placeholder policy: weather beds, interior ambience and functional SFX have
 * no recorded assets yet, so this engine ships clearly-labelled WebAudio-
 * synthesised placeholders routed through the same buses/captions as future
 * recorded samples (swap-in is internal to this file).
 */

const DEFAULT_LEVELS = Object.freeze({
  master: 0.8,
  music: 0.6,
  weather: 0.7,
  ambience: 0.6,
  fx: 0.7,
});

const BUS_NAMES = Object.freeze(["master", "music", "weather", "ambience", "fx"]);

const DEFAULT_SFX_LIBRARY = Object.freeze({
  ui_tap:        { caption: "[soft tap]",                              label: "Tap",                 placeholder: true },
  ui_step:       { caption: "[gentle transition]",                     label: "Screen change",       placeholder: true },
  pour_start:    { caption: "[tea pours in a slow ribbon]",            label: "Pour starts",         placeholder: true },
  pour_layer:    { caption: "[a new layer settles into the cup]",      label: "Layer settles",       placeholder: true },
  glass_pickup:  { caption: "[a glass is lifted from the tray]",       label: "Glass picked up",     placeholder: true },
  brew_complete: { caption: "[the kettle sighs — brew complete]",      label: "Brew complete",       placeholder: true },
  order_ready:   { caption: "[three soft chimes — order ready]",       label: "Order ready",         placeholder: true },
  cup_award:     { caption: "[a warm little flourish — cup earned]",   label: "Reward cup",          placeholder: true },
  gentle_block:  { caption: "[soft double-tap: that pour is not available]", label: "Gentle block",  placeholder: true },
  undo:          { caption: "[the tea swirls back — undone]",          label: "Undo",                placeholder: true },
  reset:         { caption: "[the cup empties for a fresh start]",     label: "Start over",          placeholder: true },
  hint:          { caption: "[a sparkle of guidance]",                 label: "Hint",                placeholder: true },
  journal_open:  { caption: "[pages part — journal opens]",            label: "Journal opens",       placeholder: true },
  journal_save:  { caption: "[a page keeps your blend]",               label: "Saved to journal",    placeholder: true },
  mode_quiet:    { caption: "[the room grows quieter]",                label: "Quiet Mode",          placeholder: true },
  familiar_chime:{ caption: "[a small friendly trill]",                label: "Companion",           placeholder: true },
  weather_change:{ caption: "[the weather turns outside]",             label: "Weather turns",       placeholder: true },
});

const memoryStorages = new Map();

function defaultStorage(key) {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch (_) { /* private mode etc. */ }
  if (!memoryStorages.has(key)) memoryStorages.set(key, new Map());
  const m = memoryStorages.get(key);
  return {
    get: (k) => (m.has(k) ? m.get(k) : null),
    set: (k, v) => void m.set(k, v),
  };
}

export class TeaAudioEngine {
  /**
   * @param {object} opts
   * @param {object}  opts.manifest        parsed audio/music/manifest.json
   * @param {string}  opts.assetBase       URL dir that contains finals/ (and manifest.json)
   * @param {string[]} opts.allowedStatuses  track.status values eligible for playback.
   *        Shipping builds should pass ['approved']; prototype wiring may add
   *        'mastered_pending_listen_review' so the Director can hear the library.
   * @param {Storage-like} [opts.storage]   {get,set} — defaults to localStorage
   * @param {string}  [opts.storageKey]    persistence key (game: 'mth.audio.v1')
   * @param {(text: string) => void} [opts.onCaption]   functional-cue captions
   * @param {(track: object, playlistId: string) => void} [opts.onNowPlaying]
   */
  constructor(opts = {}) {
    if (!opts.manifest) throw new Error("TeaAudioEngine: manifest required");
    this.manifest = opts.manifest;
    this.assetBase = (opts.assetBase || "audio/music").replace(/\/$/, "");
    this.allowedStatuses = opts.allowedStatuses || ["approved"];
    this.storage = opts.storage || defaultStorage(opts.storageKey || "mth.audio.v1");
    this.storageKey = opts.storageKey || "mth.audio.v1";
    this.onCaption = opts.onCaption || null;
    this.onNowPlaying = opts.onNowPlaying || null;

    /** @type {Record<string, Array<{id,title,mood,file,status}>>} */
    this.playlists = {};
    this.playlistId = null;
    this.order = [];
    this.orderPos = 0;
    this.lastPlayedTrackId = null;

    this.levels = { ...DEFAULT_LEVELS };
    this.muted = { master: false, music: false, weather: false, ambience: false, fx: false };
    this.crossfade = 5;           // seconds, 0–8, equal-power
    this.shuffle = false;
    this.musicOn = true;
    this.weatherMode = "none";    // 'none' | 'rain' | 'snow'
    this.ambienceOn = false;
    this.unlocked = false;

    this.sfx = { ...DEFAULT_SFX_LIBRARY };

    /** @private */ this.ctx = null;
    /** @private */ this.buses = {};
    /** @private */ this.now = null;            // {track, source, gain, playlistId}
    /** @private */ this.nextTimer = null;
    /** @private */ this.xfTimer = null;
    /** @private */ this.bufferCache = new Map(); // track.id -> AudioBuffer
    /** @private */ this.decoding = new Map();    // track.id -> Promise<AudioBuffer>
    /** @private */ this.weatherNodes = null;
    /** @private */ this.ambienceNodes = null;
    /** @private */ this.pendingSfx = [];
  }

  // ---------------------------------------------------------------- setup --

  /** Filter the manifest by allowedStatuses and restore persisted settings. */
  async init() {
    const allowed = new Set(this.allowedStatuses);
    const byId = new Map();
    for (const t of this.manifest.tracks || []) {
      if (allowed.has(t.status)) byId.set(t.id, {
        id: t.id,
        title: t.title,
        mood: t.mood,
        file: t.file,
        status: t.status,
      });
    }
    this.playlists = {};
    for (const [name, ids] of Object.entries(this.manifest.playlists || {})) {
      const list = ids.map((id) => byId.get(id)).filter(Boolean);
      if (list.length) this.playlists[name] = list;
    }

    const saved = this._load();
    if (saved) {
      if (saved.levels) for (const b of BUS_NAMES) {
        if (typeof saved.levels[b] === "number") this.levels[b] = clamp01(saved.levels[b]);
      }
      if (saved.muted) for (const b of BUS_NAMES) this.muted[b] = !!saved.muted[b];
      if (typeof saved.crossfade === "number") this.crossfade = clamp(saved.crossfade, 0, 8);
      if (typeof saved.shuffle === "boolean") this.shuffle = saved.shuffle;
      if (typeof saved.musicOn === "boolean") this.musicOn = saved.musicOn;
      if (saved.playlistId && this.playlists[saved.playlistId]) this.playlistId = saved.playlistId;
      if (saved.weatherMode) this.weatherMode = saved.weatherMode;
      if (typeof saved.ambienceOn === "boolean") this.ambienceOn = saved.ambienceOn;
    }
    if (!this.playlistId) {
      const names = this.playlistNames();
      this.playlistId = names.length ? names[0] : null;
    }
    this._buildOrder(false);
  }

  playlistNames() {
    return Object.keys(this.playlists);
  }

  /** Create the AudioContext + bus graph. Call from a user gesture. */
  async unlock() {
    if (this.unlocked) return;
    const AC = typeof AudioContext !== "undefined" ? AudioContext
      : (typeof webkitAudioContext !== "undefined" ? webkitAudioContext : null);
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === "suspended") { try { await this.ctx.resume(); } catch (_) { /* ignore */ } }

    const dest = this.ctx.destination;
    const mk = () => this.ctx.createGain();
    // master → destination; each bus → master. Plain GainNodes everywhere on
    // the music path: no DynamicsCompressor, no normalisation (spec).
    this.buses = { master: mk(), music: mk(), weather: mk(), ambience: mk(), fx: mk() };
    for (const b of BUS_NAMES) if (b !== "master") this.buses[b].connect(this.buses.master);
    this.buses.master.connect(dest);
    for (const b of BUS_NAMES) this._applyBus(b);

    this.unlocked = true;

    // deferred desires
    this._applyWeather(this.weatherMode);
    if (this.ambienceOn) this._setAmbienceNodes(true);
    for (const id of this.pendingSfx) this._renderSfx(id);
    this.pendingSfx = [];
    if (this.musicOn) this._startMusicFromNext();
  }

  // ----------------------------------------------------------- persistence --

  /** @private */ _load() {
    try {
      const raw = this.storage.get(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /** @private */ _save() {
    try {
      this.storage.set(this.storageKey, JSON.stringify({
        levels: this.levels,
        muted: this.muted,
        crossfade: this.crossfade,
        shuffle: this.shuffle,
        musicOn: this.musicOn,
        playlistId: this.playlistId,
        weatherMode: this.weatherMode,
        ambienceOn: this.ambienceOn,
      }));
    } catch (_) { /* storage full / unavailable */ }
  }

  // ------------------------------------------------------------------ mix --

  setLevel(bus, v) {
    if (!BUS_NAMES.includes(bus)) return;
    this.levels[bus] = clamp01(v);
    if (this.unlocked) this._applyBus(bus);
    this._save();
  }

  setMuted(bus, on) {
    if (!BUS_NAMES.includes(bus)) return;
    this.muted[bus] = !!on;
    if (this.unlocked) this._applyBus(bus);
    this._save();
  }

  /** @private */ _applyBus(bus) {
    if (!this.ctx || !this.buses[bus]) return;
    const g = this.muted[bus] ? 0 : this.levels[bus];
    // small constant ramp avoids zipper noise; level changes are not musical
    // events so this never ducks or restarts a track
    this.buses[bus].gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
  }

  setCrossfade(seconds) {
    this.crossfade = clamp(Number(seconds) || 0, 0, 8);
    this._save();
  }

  setShuffle(on) {
    this.shuffle = !!on;
    this._buildOrder(true);
    this._save();
  }

  setPlaylist(name) {
    if (!this.playlists[name]) return;
    this.playlistId = name;
    this._buildOrder(true);
    this._save();
  }

  setMusicOn(on) {
    this.musicOn = !!on;
    this._save();
    if (!on) {
      // fully stop scheduling; position discarded (spec: resume at NEXT start)
      this._stopMusic();
    } else if (this.unlocked) {
      this._startMusicFromNext();
    }
  }

  // --------------------------------------------------------------- playlist --

  /** @private */
  _buildOrder(reshuffle) {
    const list = this.playlists[this.playlistId];
    if (!list || !list.length) { this.order = []; return; }
    this.order = list.map((_, i) => i);
    if (this.shuffle) {
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
      // spec: shuffle never repeats the last-played track first after reshuffle
      if (reshuffle && this.lastPlayedTrackId && this.order.length > 1) {
        if (list[this.order[0]].id === this.lastPlayedTrackId) {
          const j = 1 + Math.floor(Math.random() * (this.order.length - 1));
          [this.order[0], this.order[j]] = [this.order[j], this.order[0]];
        }
      }
    }
    this.orderPos = Math.min(this.orderPos, this.order.length - 1);
  }

  /** @private */ _trackMeta(index) {
    const list = this.playlists[this.playlistId];
    if (!list || !list.length) return null;
    return list[((index % list.length) + list.length) % list.length];
  }

  nextTrack() {
    if (!this.unlocked) return; // safe pre-unlock
    if (!this.musicOn) return;
    if (!this.playlistId) return;
    if (!this.order.length) this._buildOrder(true);
    if (!this.order.length) return;
    this._crossfadeTo((this.orderPos + 1) % this.order.length, Math.min(this.crossfade, 1.2));
  }

  prevTrack() {
    if (!this.unlocked || !this.musicOn || !this.playlistId) return;
    if (!this.order.length) this._buildOrder(true);
    if (!this.order.length) return;
    this._crossfadeTo((this.orderPos - 1 + this.order.length) % this.order.length, Math.min(this.crossfade, 1.2));
  }

  /** @private — spec: OFF→ON resumes at the NEXT track start, never mid-phrase */
  _startMusicFromNext() {
    if (!this.playlistId) return;
    if (!this.order.length) this._buildOrder(true);
    if (!this.order.length) return;
    // advance past whatever played last; start at head if nothing yet
    this.orderPos = this.lastPlayedTrackId ? (this.orderPos + 1) % this.order.length : 0;
    this._play(this.order[this.orderPos], 0);
  }

  /** @private */ _stopMusic() {
    if (this.nextTimer) { clearTimeout(this.nextTimer); this.nextTimer = null; }
    if (this.xfTimer) { clearTimeout(this.xfTimer); this.xfTimer = null; }
    if (this.now) {
      try { this.now.source.onended = null; this.now.source.stop(); } catch (_) { /* already stopped */ }
      this.now = null;
    }
  }

  /** @private */
  async _play(orderIndex, delaySec) {
    if (!this.ctx || !this.musicOn) return;
    const meta = this._trackMeta(orderIndex);
    if (!meta) return;
    let buf;
    try {
      buf = await this._getBuffer(meta);
    } catch (err) {
      // skip broken track, keep the playlist alive
      console.warn("playback error, skipping track", err);
      this.lastPlayedTrackId = meta.id;
      this.orderPos = orderIndex;
      setTimeout(() => { if (this.musicOn && this.unlocked) this._startMusicFromNext(); }, 300);
      return;
    }
    if (!this.ctx || !this.musicOn) return; // state may have changed while fetching

    this._teardownCurrent();

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    src.connect(g).connect(this.buses.music);

    const xf = this.crossfade;
    const t0 = this.ctx.currentTime + (delaySec || 0);
    if (xf > 0) {
      g.gain.setValueAtTime(0, t0);
      g.gain.setValueCurveAtTime(equalPowerIn(xf), t0, xf);
    } else {
      g.gain.setValueAtTime(1, t0); // finals carry baked 1.5 s fade-in
    }
    src.start(t0);

    this.now = { track: meta, source: src, gain: g, playlistId: this.playlistId };
    this.orderPos = orderIndex;
    this.lastPlayedTrackId = meta.id;
    if (this.onNowPlaying) {
      try { this.onNowPlaying(meta, this.playlistId); } catch (_) { /* UI hook */ }
    }

    // schedule crossfade near the end (finals bake a 4 s fade-out, so a hard
    // stop at end is also seam-free when crossfade = 0)
    const ms = Math.max(250, (buf.duration - xf - 0.15) * 1000);
    this.xfTimer = setTimeout(() => {
      this.xfTimer = null;
      if (this.musicOn && this.unlocked && this.now && this.now.track.id === meta.id) {
        this._crossfadeTo((this.orderPos + 1) % this.order.length, xf);
      }
    }, ms);
    // safety: if crossfade never fired (tab throttling), onended picks it up
    src.onended = () => {
      if (this.now && this.now.track.id === meta.id) {
        this.now = null;
        if (this.musicOn && this.unlocked) {
          this.nextTimer = setTimeout(() => {
            this.nextTimer = null;
            if (this.musicOn && this.unlocked) this._startMusicFromNext();
          }, 50);
        }
      }
    };
  }

  /** @private */ _teardownCurrent() {
    if (this.xfTimer) { clearTimeout(this.xfTimer); this.xfTimer = null; }
    if (!this.now) return;
    const old = this.now;
    this.now = null;
    try { old.source.onended = null; } catch (_) { /* noop */ }
  }

  /**
   * @private — start `orderIndex` and fade out whatever is playing.
   * Equal-power: new gain sin(x·π/2), old gain cos(x·π/2).
   */
  async _crossfadeTo(orderIndex, xf) {
    this.orderPos = orderIndex;
    const meta = this._trackMeta(orderIndex);
    if (!meta) return;
    const buf = await this._getBuffer(meta);
    if (!this.ctx) return;
    if (!this.musicOn) return;

    const old = this.now;
    const t0 = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    src.connect(g).connect(this.buses.music);

    if (xf > 0 && old) {
      g.gain.setValueAtTime(0, t0);
      g.gain.setValueCurveAtTime(equalPowerIn(xf), t0, xf);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t0);
      old.gain.gain.setValueCurveAtTime(equalPowerOut(xf), t0, xf);
      const dying = old;
      setTimeout(() => {
        try { dying.source.onended = null; dying.source.stop(); } catch (_) { /* noop */ }
      }, xf * 1000 + 120);
    } else {
      if (old) { try { old.source.onended = null; old.source.stop(); } catch (_) { /* noop */ } }
      g.gain.setValueAtTime(1, t0);
    }
    src.start(t0);

    this.now = { track: meta, source: src, gain: g, playlistId: this.playlistId };
    this.lastPlayedTrackId = meta.id;
    if (this.onNowPlaying) {
      try { this.onNowPlaying(meta, this.playlistId); } catch (_) { /* UI hook */ }
    }

    const ms = Math.max(250, (buf.duration - xf - 0.15) * 1000);
    this.xfTimer = setTimeout(() => {
      this.xfTimer = null;
      if (this.musicOn && this.unlocked && this.now && this.now.track.id === meta.id) {
        this._crossfadeTo((this.orderPos + 1) % this.order.length, xf);
      }
    }, ms);
    src.onended = () => {
      if (this.now && this.now.track.id === meta.id) {
        this.now = null;
        if (this.musicOn && this.unlocked) {
          this.nextTimer = setTimeout(() => {
            this.nextTimer = null;
            if (this.musicOn && this.unlocked) this._startMusicFromNext();
          }, 50);
        }
      }
    };
  }

  // ---------------------------------------------------------------- assets --

  /**
   * Manifest `file` fields look like `audio/music/finals/<name>.ogg` (paths
   * inside the source asset repo). The spec says playback loads only from
   * finals/, so resolve against <assetBase>/finals/<basename> — robust to
   * whatever layout the manifest was written for.
   * @private
   */
  _trackUrl(file) {
    const base = file.split("finals/").pop() || file;
    return `${this.assetBase}/finals/${base}`;
  }

  /** @private — fetch + decode with cache and in-flight de-duplication */
  async _getBuffer(track) {
    if (this.bufferCache.has(track.id)) return this.bufferCache.get(track.id);
    if (this.decoding.has(track.id)) return this.decoding.get(track.id);
    const p = (async () => {
      const url = this._trackUrl(track.file);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`audio fetch failed: ${url}`);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.bufferCache.set(track.id, buf);
      // keep cache small (decoded PCM is big); never evict the playing track
      if (this.bufferCache.size > 6) {
        const firstKey = this.bufferCache.keys().next().value;
        const playing = this.now?.track?.id;
        if (firstKey !== playing) this.bufferCache.delete(firstKey);
      }
      return buf;
    })();
    this.decoding.set(track.id, p);
    try { return await p; } finally { this.decoding.delete(track.id); }
  }

  // ------------------------------------------- weather / ambience (placeholder beds) --

  /** Weather bed on its own bus; NEVER touches the music player. */
  setWeather(mode) {
    const m = mode === "rain" || mode === "snow" ? mode : "none";
    this.weatherMode = m;
    this._save();
    if (this.unlocked) this._applyWeather(m);
  }

  setAmbience(on) {
    this.ambienceOn = !!on;
    this._save();
    if (this.unlocked) this._setAmbienceNodes(this.ambienceOn);
  }

  /** @private */ _applyWeather(mode) {
    this._stopWeatherNodes();
    if (mode === "none" || !this.ctx) return;
    this._startWeatherNodes(mode);
  }

  /** @private — synthesised placeholder beds; swap-in point for real samples */
  _startWeatherNodes(mode) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, mode === "snow" ? "brown" : "white", 4);
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    const swell = ctx.createGain();
    if (mode === "rain") {
      filt.type = "bandpass"; filt.frequency.value = 1400; filt.Q.value = 0.5;
      swell.gain.value = 0.16;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain).connect(swell.gain);
      lfo.start();
      this.weatherNodes = { src, nodes: [filt, swell], lfo };
    } else {
      filt.type = "lowpass"; filt.frequency.value = 240;
      swell.gain.value = 0.05;
      this.weatherNodes = { src, nodes: [filt, swell], lfo: null };
    }
    src.connect(filt).connect(swell).connect(this.buses.weather);
    src.start();
  }

  /** @private */ _stopWeatherNodes() {
    const w = this.weatherNodes;
    if (!w) return;
    this.weatherNodes = null;
    try { w.src.stop(); } catch (_) { /* noop */ }
    if (w.lfo) { try { w.lfo.stop(); } catch (_) { /* noop */ } }
  }

  /** @private */ _setAmbienceNodes(on) {
    this._stopAmbienceNodes();
    if (!on || !this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, "brown", 5);
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 160;
    const g = ctx.createGain(); g.gain.value = 0.09;
    src.connect(filt).connect(g).connect(this.buses.ambience);
    src.start();
    this.ambienceNodes = { src, nodes: [filt, g] };
  }

  /** @private */ _stopAmbienceNodes() {
    const a = this.ambienceNodes;
    if (!a) return;
    this.ambienceNodes = null;
    try { a.src.stop(); } catch (_) { /* noop */ }
  }

  // -------------------------------------------------------------------- sfx --

  /** id → {caption, label, placeholder} for every functional cue. */
  sfxLibrary() {
    return this.sfx;
  }

  /**
   * Fire a functional cue. ALWAYS emits its caption — including before audio
   * unlock and while the FX bus (or master) is muted: audio is never the only
   * signal (spec, Accessibility).
   */
  playSfx(id) {
    const cue = this.sfx[id];
    if (!cue) return;
    if (this.onCaption) {
      try { this.onCaption(cue.caption); } catch (_) { /* UI hook */ }
    }
    if (!this.unlocked) { this.pendingSfx.push(id); return; }
    this._renderSfx(id);
  }

  /** @private — gentle synthesised placeholder cues */
  _renderSfx(id) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.connect(this.buses.fx);

    const blip = (freq, t0, dur, type = "sine", vol = 0.18) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(out);
      o.start(t0); o.stop(t0 + dur + 0.05);
      return o;
    };

    switch (id) {
      case "ui_tap": blip(660, t, 0.09, "sine", 0.12); break;
      case "ui_step": blip(440, t, 0.16, "sine", 0.10); blip(550, t + 0.07, 0.16, "sine", 0.08); break;
      case "pour_start": {
        const n = this.ctx.createBufferSource();
        n.buffer = noiseBuffer(this.ctx, "white", 1);
        const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.10, t + 0.08);
        g.gain.setTargetAtTime(0.0001, t + 0.7, 0.12);
        n.connect(f).connect(g).connect(out);
        n.start(t); n.stop(t + 1.4);
        break;
      }
      case "pour_layer": blip(320, t, 0.22, "sine", 0.12); blip(392, t + 0.10, 0.26, "sine", 0.09); break;
      case "glass_pickup": blip(880, t, 0.07, "triangle", 0.10); blip(1174, t + 0.05, 0.09, "triangle", 0.07); break;
      case "brew_complete": blip(523, t, 0.3, "sine", 0.12); blip(659, t + 0.12, 0.34, "sine", 0.10); blip(784, t + 0.26, 0.5, "sine", 0.09); break;
      case "order_ready": [784, 988, 1175].forEach((f, i) => blip(f, t + i * 0.14, 0.28, "sine", 0.11)); break;
      case "cup_award": [523, 659, 784, 1047].forEach((f, i) => blip(f, t + i * 0.11, 0.4, "triangle", 0.08)); break;
      case "gentle_block": blip(220, t, 0.08, "sine", 0.10); blip(220, t + 0.12, 0.08, "sine", 0.08); break;
      case "undo": blip(500, t, 0.18, "sine", 0.09); blip(380, t + 0.09, 0.2, "sine", 0.08); break;
      case "reset": {
        const n = this.ctx.createBufferSource();
        n.buffer = noiseBuffer(this.ctx, "white", 1);
        const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 500;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        n.connect(f).connect(g).connect(out);
        n.start(t); n.stop(t + 0.6);
        break;
      }
      case "hint": blip(1319, t, 0.25, "sine", 0.07); blip(1568, t + 0.1, 0.3, "sine", 0.05); break;
      case "journal_open": {
        const n = this.ctx.createBufferSource();
        n.buffer = noiseBuffer(this.ctx, "white", 1);
        const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        n.connect(f).connect(g).connect(out);
        n.start(t); n.stop(t + 0.4);
        break;
      }
      case "journal_save": blip(587, t, 0.2, "sine", 0.09); blip(880, t + 0.12, 0.3, "sine", 0.08); break;
      case "mode_quiet": blip(392, t, 0.5, "sine", 0.08); blip(494, t + 0.2, 0.6, "sine", 0.06); break;
      case "familiar_chime": blip(1047, t, 0.12, "triangle", 0.08); blip(1319, t + 0.09, 0.14, "triangle", 0.06); break;
      case "weather_change": {
        const n = this.ctx.createBufferSource();
        n.buffer = noiseBuffer(this.ctx, "white", 2);
        const f = this.ctx.createBiquadFilter(); f.type = "lowpass";
        f.frequency.setValueAtTime(3000, t);
        f.frequency.exponentialRampToValueAtTime(300, t + 0.9);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        n.connect(f).connect(g).connect(out);
        n.start(t); n.stop(t + 1.1);
        break;
      }
      default: break;
    }
    setTimeout(() => { try { out.disconnect(); } catch (_) { /* noop */ } }, 2500);
  }
}

// ------------------------------------------------------------------ helpers --

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clamp01(v) { return clamp(Number(v) || 0, 0, 1); }

/** Equal-power fade curves for setValueCurveAtTime. */
function equalPowerIn() {
  const N = 64;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) curve[i] = Math.sin((i / (N - 1)) * Math.PI / 2);
  return curve;
}
function equalPowerOut() {
  const N = 64;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) curve[i] = Math.cos((i / (N - 1)) * Math.PI / 2);
  return curve;
}

const noiseCache = new Map();
/** Cached 2-channel noise buffers: 'white' | 'brown'. */
function noiseBuffer(ctx, kind, seconds) {
  const key = `${kind}:${seconds}:${ctx.sampleRate}`;
  if (noiseCache.has(key)) return noiseCache.get(key);
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    if (kind === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  noiseCache.set(key, buf);
  return buf;
}

export default TeaAudioEngine;
