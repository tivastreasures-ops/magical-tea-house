# Magical Tea House — the 3D game

**The Magical Tea Tent / Cozy Tea**, 3D web edition: a gentle sanctuary with tea
to pour and a quiet corner to sit in. Built with **Next.js + three.js** — no
score, no timer, no wrong way to be here. This repo also hosts the project's
**music library pipeline** (generation, mastering, QC, playback spec), which is
the source of truth the game's soundtrack is served from.

The **2D sibling** lives at
[`tivastreasures-ops/tea-house-magic`](https://github.com/tivastreasures-ops/tea-house-magic).

## Run it

```bash
bun install        # or npm install / pnpm install
bun run dev        # http://localhost:3000
```

Production: `bun run build` then `bun run start` (standalone output).
Desktop-first; **WebXR (Quest 3, seated) is a later milestone** and is
intentionally not stubbed as working.

## Repo layout

| Path | What it is |
|---|---|
| `src/game/` | The 3D engine: renderer/camera/locomotion (`engine.ts`), tent world (`world.ts`), glassware & effects (`glass.ts`), procedural textures (`textures.ts`), service & quiet mode controllers (`modes.ts`), puzzles, data, zustand store, persistence. |
| `src/game/audio.ts` | Audio: **real 40-track library** (manifest playlists, sequential repeat, 5 s equal-power crossfade) + synthesised weather/ambience/SFX placeholders. |
| `src/components/game/` | React HUD: overlay, panels (atmosphere, settings, journal, cup customisation). |
| `src/app/` | Next.js app shell. |
| `public/assets/` | MTT concept art + provenance manifest (`MTT_[family]_[asset]_[view]_v##`). References, never completion claims. |
| `public/audio/music/` | Served copy of the soundtrack (finals + manifest + playlists), mirrored from `audio/music/`. |
| `audio/music/` | **Source of truth**: originals, mastered finals, manifest, playlist CSVs, QC report. |
| `docs/audio-playback-spec.md` | Acceptance spec: player behaviour, mixer buses, accessibility rules. |
| `docs/integration-notes.md` | How the spec maps onto the reference engine and the 2D build. |
| `integration/` | Dependency-free reference `TeaAudioEngine` + demo page. |
| `tools/music/` | Python pipeline: fetch/master/analyse the music. |

## Music wiring

- The game fetches `/audio/music/manifest.json` and plays `finals/*.ogg`
  through its music bus at the masters' −18 LUFS value — no normalisation, no
  limiter (spec §Mixer).
- Playlists follow `manifest.playlists` order, repeat continuously; track
  changes crossfade over 5 s (equal-power).
- Prototype wiring allows `mastered_pending_listen_review` tracks so the
  Director can hear the whole library in context; a shipping build narrows
  `ALLOWED_STATUSES` in `src/game/audio.ts` to `['approved']`.
- Weather beds, room ambience and functional SFX are still clearly-labelled
  WebAudio placeholders — no recorded assets exist for those families yet.
- To refresh the served copy after re-mastering:
  `cp audio/music/finals/*.ogg public/audio/music/finals/ && cp audio/music/manifest.json public/audio/music/`

## Status

First playable 3D prototype: two modes (Tea Service with teaching puzzles,
Quiet Nook), atmosphere (light/weather/playlist), journal, cup customisation,
reduced-motion and sound-off fully supported. Listening QC on the soundtrack is
still outstanding (see `audio/music/README.md`).
