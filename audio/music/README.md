# Music — four original instrumental playlists

40 original tracks (4 playlists × 10), generated with **ElevenLabs Music v2.5** on 2026-11-05.
Full per-track data: [`manifest.json`](manifest.json) · per-playlist CSVs in [`playlists/`](playlists/) · playback rules: [`docs/audio-playback-spec.md`](../../docs/audio-playback-spec.md).

## Status

| | |
|---|---|
| Generated | **40 / 40**, instrumental mode, 180 s requested (S07 came back at 174 s) |
| Downloaded / mastered | **0 / 40**: the build session's network policy blocked `elevenlabsusercontent.com`, so the audio files are not in this repo yet |
| Listening QC | not started; needs the files |
| Credits spent | 40 × 2,699.4 = **107,976 credits** (~$19.63 at the workspace rate shown) |

Every track has `status: generated_not_downloaded` until it is fetched and mastered.

## Get the audio

```bash
python3 tools/music/fetch_and_master.py
```
- Downloads each original into `originals/<ID>_<generation_id>.mp3` (never modified), then masters it into `finals/<ID>_<title>.wav` (48 kHz/16-bit, −18 LUFS, −2 dBTP ceiling, 1.5 s fade-in / 4 s fade-out) and writes the measured loudness and auto-QC flags into `manifest.json`.
- The signed `content_url`s in the manifest **expire 2026-11-05 10:00 UTC**. After that, open each track's `elevenlabs_song_url` (ElevenLabs › Music) or the flow ([link](https://elevenlabs.io/app/flows/kfEelr4XEy3bbaAMmnqp)), download the MP3 into `originals/` with the same filename, and re-run the script. Existing originals are not re-downloaded.
- Audio files are tracked with Git LFS (`.gitattributes`). Run `git lfs install` before committing them.

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
