# Magical Tea House — music & audio asset library

**This is not the game.** It is the companion **audio asset repo** for
[`tivastreasures-ops/tea-house-magic`](https://github.com/tivastreasures-ops/tea-house-magic),
the playable 2D web prototype of *Magical Tea Tent / Cozy Tea*. The game repo
embeds copies of the mastered tracks so it runs standalone; this repo is the
**source of truth** for the music, the playback spec it must follow, and the
reference engine that spec was validated against.

## Repo layout

| Path | What it is |
|---|---|
| `audio/music/originals/` | 40 untouched MP3 masters (48 kHz stereo, 192 kbps) as delivered by the generator. Never modified. |
| `audio/music/finals/` | 40 mastered OGG (Vorbis q6) files the game actually loads. |
| `audio/music/manifest.json` | Per-track data: ids, titles, playlists, durations, generation ids, status, file paths. |
| `audio/music/playlists/` | One CSV per playlist (track order). |
| `audio/music/qc_report.json` | Objective QC measurements for all 40 tracks. |
| `audio/music/README.md` | Detailed generation/mastering/QC status and how to rebuild. |
| `docs/audio-playback-spec.md` | **Acceptance spec**: player behaviour, mixer buses, accessibility rules. |
| `docs/integration-notes.md` | How the spec maps onto the reference engine, and how the game consumes it. |
| `integration/tea-audio-engine.js` | Dependency-free ES module implementing the spec (buses, playlist player, crossfade, placeholder SFX/beds, captions, persistence). |
| `integration/index.html` | Demo page: plays this repo's own finals through the engine with the full mixer UI. |
| `tools/music/` | Python pipeline: `fetch_and_master.py` (rebuild WAV + OGG from originals), `analyze.py` (rewrite QC report), `qc_master.py`. |

## The music

Four original instrumental playlists, **40 tracks** (4 × 10), generated with
ElevenLabs Music v2.5 on 2026-11-05:

| Playlist | Ids | Palette |
|---|---|---|
| Rainy Twilight | R01–R10 | felt piano, soft harp, muted strings, distant celesta |
| Golden Garden | G01–G10 | plucked strings, harp, flute, warm piano, light woodwind |
| Starlit Night | S01–S10 | celesta, glassy pads, soft harp, distant strings |
| Winter Refuge | W01–W10 | warm cello, soft piano, muted harp, music-box bells |

Finals are mastered to **−18.0 LUFS ±0.1, true peak ≤ −2 dBTP**, with a baked
1.5 s fade-in / 4 s fade-out. Every track is currently
`status: mastered_pending_listen_review` — **listening QC has not been done**
and is required before any track may be marked `approved`.

## Relationship to the game

- The game (`tea-house-magic/js/audio-engine.js`) is the same engine, wired to
  the game UI; it loads `finals/*.ogg` via `manifest.json`.
- The prototype wiring includes `mastered_pending_listen_review` tracks so the
  Director can hear the whole library in context; a shipping build must pass
  `['approved']` only.
- Weather beds, room ambience and functional SFX have **no recorded assets
  yet** — the engine ships clearly-labelled WebAudio-synthesised placeholders
  (see `docs/integration-notes.md`).

## Run the audio demo

```bash
python3 -m http.server 8000
# open http://localhost:8000/integration/
```

## Rebuild / re-fetch

```bash
python3 tools/music/fetch_and_master.py   # rebuilds WAV + OGG finals from originals/
pip install numpy && python3 tools/music/analyze.py   # rewrites qc_report.json
```

Note: the original signed download links expired 2026-11-05; for a re-fetch
use each track's `elevenlabs_song_url` (see `audio/music/README.md`).
