# Audio integration notes

How `docs/audio-playback-spec.md` maps onto the reference wiring shipped in this repo, and how
the 2D web build in [`tea-house-magic`](https://github.com/tivastreasures-ops/tea-house-magic)
consumes the same engine.

## Files

| Path | Purpose |
|---|---|
| `integration/tea-audio-engine.js` | Dependency-free ES module implementing the playback spec (buses, playlist player, crossfade, placeholder SFX + beds, captions, persistence). |
| `integration/index.html` | Demo page wiring the repo's own `audio/music/` finals through the engine, with the full mixer UI. |
| `audio/music/` (untouched) | Source of truth: finals, manifest, playlist CSVs, QC report. |

The audio assets, manifest and QC data were **not modified** by this integration.

## Spec rule → implementation map

| Spec rule | Implementation |
|---|---|
| Sequential / shuffle within playlist, repeat continuously | `TeaAudioEngine._buildOrder` / `_crossfadeTo`; order cycles with `(pos+1) % len`. |
| Shuffle never repeats last-played track first after reshuffle | `_buildOrder(reshuffle=true)` swaps the head if it matches `lastPlayedTrackId`. |
| Crossfade 3–8 s (default 5), equal-power | `setCrossfade`; `_crossfadeTo` uses sin/cos `setValueCurveAtTime` ramps. `0` permitted — finals carry a baked 1.5 s fade-in / 4 s fade-out so a hard cut at track end is seam-free. |
| Music OFF is first-class, resume at next track start | `setMusicOn(false)` fully stops scheduling (position discarded); `setMusicOn(true)` calls `_startMusicFromNext()` which advances one slot and starts that track at its beginning. |
| Weather independence | The weather bed lives on its own bus; `setWeather` never touches the music player (no restart, no ducking, no playlist switch). |
| Atmosphere swatches may suggest, never lock | Not part of the engine; callers (game UI) may pre-select a playlist as a *suggestion* only. |
| Bus levels: Master 80 / Music 60 / Weather 70 / Ambience 60 / FX 70, each with mute | `DEFAULT_LEVELS`, `setLevel`, `setMuted`, persisted under `mth.audio.v1` (game) / `mth.integration.demo.v1` (demo). |
| No normalisation or limiter on the Music bus | Music bus is a plain `GainNode`; masters are used at their −18 LUFS value, no DynamicsCompressor anywhere. |
| Every functional cue has a visual equivalent | Every `playSfx(id)` emits `onCaption(text)`; the UI renders it in a persistent caption region. Cues still fire their caption when the FX bus is muted. |
| Optional "Now playing" toast | `onNowPlaying(track, playlist)` callback. |
| Reduced-motion & sound-off must be fully functional | The engine has no visual dependencies; the game renders all state (orders, pours, journal, weather) visually and treats audio as an enhancement. |
| Game loads only from `finals/`, only `approved` tracks | Engine filters by `allowedStatuses`. **Prototype wiring includes `mastered_pending_listen_review`** so the Director can hear the library in context; a shipping build passes `['approved']` only. |

## Placeholder audio policy

The manifest covers the 4 music playlists (40 finals). The spec's *other* families
(weather beds, interior ambience, functional SFX such as pour / brew-complete / journal) have **no
recorded assets yet**. The engine ships clearly-labelled WebAudio-synthesised placeholders for them:

- `setWeather('rain' | 'snow' | 'none')` — filtered noise beds (rain: band-passed white noise with a
  slow swell LFO; snow: near-silent low-passed brown noise).
- `setAmbience(true | false)` — soft low-passed room tone.
- `playSfx(...)` — 17 gentle synthesised cues (`sfxLibrary()` lists every id + caption text).

All placeholders route through the same buses and captions as future recorded samples, so swapping
in real files later is a drop-in change inside the engine only.

## Running the demo

```bash
# from the magical-tea-house repo root
python3 -m http.server 8000
# open http://localhost:8000/integration/
```

A web server is required for module imports and `fetch()` of the manifest/OGGs
(`file://` will not work).

## Status / provenance

- Integration authored 2026-11-06 as part of the first-playable prototype work (Task: "find audio
  assets, wire appropriately").
- Music: ElevenLabs Music v2.5 generations, mastered to −18 LUFS integrated / −2 dBTP (see
  `audio/music/manifest.json` and `qc_report.json`; `rejects.json` is empty).
- Human listen-review (quality-gate step 9 of the spec) is still pending for the wired tracks; they
  are wired as `mastered_pending_listen_review`, not `approved`.
