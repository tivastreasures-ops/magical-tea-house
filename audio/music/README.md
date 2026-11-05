# Music — four original instrumental playlists

40 original tracks (4 playlists × 10), generated with **ElevenLabs Music v2.5** on 2026-11-05.
Full per-track data: [`manifest.json`](manifest.json) · per-playlist CSVs in [`playlists/`](playlists/) · playback rules: [`docs/audio-playback-spec.md`](../../docs/audio-playback-spec.md).

## Status

| | |
|---|---|
| Generated | **40 / 40**, instrumental mode, 180 s requested (S07 came back at 174 s) |
| Downloaded | **40 / 40** untouched MP3 originals (48 kHz stereo, 192 kbps) in `originals/` |
| Mastered | **40 / 40**: −18.0 LUFS ±0.1, true peak ≤ −2 dBTP in the WAV master (≤ −1.75 dBTP after OGG encoding), 1.5 s fade-in / 4 s fade-out → `finals/*.ogg` (Vorbis q6). The 48 kHz WAV masters are rebuilt locally by the script (1.3 GB, kept out of git) |
| Objective QC | done for all 40 → [`qc_report.json`](qc_report.json) (method below) |
| Listening QC | **not done**: required before any track is `approved` (see playback spec) |
| Credits spent | 107,976 (40 music generations × 2,699.4) + 3,960 (4 speech-to-text vocal checks × 990) |

Every track is `status: mastered_pending_listen_review`.

### Objective QC results (all 40)

- **Clipping:** none. The highest source sample peak was −0.2 dBFS; finals were mastered with a −2 dBTP ceiling.
- **Loudness balance:** source loudness ranged from −21.5 to −12.0 LUFS (9.5 dB spread). All finals are −18.0 ±0.1 LUFS.
- **Abrupt start/end:** after the fades, no final's first 3 s runs more than ~2 dB above its own average level; tails end below −40 dB. The pre-fade `loud_start` flag on R01, W03 and W09 refers to the raw originals.
- **Sudden loud moments:** the largest momentary swell above a track's integrated loudness is 8.6 LU (W05; range 3.0–8.6). Listen to W05 first.
- **High-frequency fatigue:** energy above 6 kHz is ≤0.04% on every track; spectral centroid 480–1,220 Hz. All tracks are dark and warm.
- **Mid-track dropouts:** none (silence detector at −55 dB for ≥1.5 s).
- **Phrase duplication:** no short-loop repetition detected. Highest self-similarity is R05 (0.87), whose brief calls for an ostinato.
- **Vocals:** speech-to-text (ElevenLabs Scribe) on the four proofs R01/G01/S01/W01 returned **no words**. The other 36 were not transcribed (990 credits each), so a listening pass is still needed.
- **Distinctness:** most similar pairs by chroma + spectrum: R01↔W01 (0.94), R01↔W08, G05↔R01, G05↔W08: piano-led tracks in related keys. Compare these by ear.
- **Not measurable by script:** copyrighted-motif resemblance, comfort in seated VR, and the sound-off/reduced-motion gameplay test.

## Rebuild / re-fetch

```bash
python3 tools/music/fetch_and_master.py  # rebuilds WAV + OGG finals from originals/ (downloads any missing original)
pip install numpy && python3 tools/music/analyze.py   # rewrites qc_report.json
```
- `originals/<ID>_<generation_id>.mp3` are never modified. If one is missing, the script downloads it from `content_url`. Those signed links expired 2026-11-05 10:00 UTC, so for a later re-fetch use the track's `elevenlabs_song_url` (ElevenLabs › Music) or the [flow](https://elevenlabs.io/app/flows/kfEelr4XEy3bbaAMmnqp).
- The game should load `finals/*.ogg` (the manifest `file` field) and only tracks whose `status` is `approved`.

## Generation settings (identical for all 40)

`model: eleven_music_v2_5`, `duration_seconds: 180`, `lyrics_type: instrumental`, `instrumental: true`, 1 take per track.
ElevenLabs Music exposes **no seed**. `generation_id` is the version identifier. Prompts follow the shared template in the brief, and the exact text per track is in the manifest.

## Verified constraints (from the ElevenLabs workspace, 2026-11-05)

- **Duration:** Music v2.5 accepts 3–600 s per generation, so no looping or stitching was needed.
- **Cost:** 2,699.4 credits per 180 s track (≈15 credits/s; the pre-run estimate showed 4,950, but the actual charge was lower). Default runs make 4 variations (4× cost), so these were run at 1 variation each.
- **Sound Effects** is a separate model (`eleven_text_to_sound_v2`, max 30 s). Both draw on the same workspace credit balance.
- **Concurrency:** the service queues music jobs past its concurrency limit and retries automatically.
- **Format delivered:** MP3 (`content.mp3`). Finals are converted to WAV by the script.
- **Licensing:** *not verified by tool.* Commercial-use rights for ElevenLabs Music depend on the account's plan and ElevenLabs' current terms. Confirm on the account's subscription page before shipping.

## Rejects

Rejected generations go in [`rejects.json`](rejects.json) by `generation_id` and must never ship. Regenerate only that track.
