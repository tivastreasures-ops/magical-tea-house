# Audio playback & acceptance spec

Source of truth for how the four music playlists behave in-game and how music assets are accepted.
Track data lives in [`audio/music/manifest.json`](../audio/music/manifest.json).

## Playlists

| Playlist | Tracks | Palette |
|---|---|---|
| Rainy Twilight | R01–R10 | felt piano, soft harp, muted strings, distant celesta |
| Golden Garden | G01–G10 | plucked strings, harp, flute, warm piano, light woodwind |
| Starlit Night | S01–S10 | celesta, glassy pads, soft harp, distant strings |
| Winter Refuge | W01–W10 | warm cello, soft piano, muted harp, restrained music-box bells |

Every track: original instrumental, ElevenLabs Music v2.5, 180 s requested, `instrumental: true`.

## Player behaviour

- **Modes:** sequential or shuffle *within the selected playlist*; repeat continuously. Shuffle never repeats the last-played track first after a reshuffle.
- **Crossfade:** optional, player-adjustable 3–8 s (default 5 s), equal-power curve. Finals already carry a 1.5 s fade-in and 4 s fade-out, so crossfade = 0 is also seam-free.
- **Music OFF** is a first-class option, not just volume 0. Turning it off pauses the decoder; turning it on resumes the playlist at the next track start (no mid-phrase restart).
- **Weather independence:** changing weather never switches, restarts or ducks the music track. The player picks music independently.
- **Atmosphere swatches** may *suggest* a playlist (UI hint / one-tap apply). They never lock or auto-switch it.
- Minor state changes (weather tick, room change, menu open) must not restart the current track.

## Mixer

Separate persisted sliders, each with a mute toggle:

| Bus | Default |
|---|---|
| Master | 80% |
| Music | 60% |
| Weather / Nature | 70% |
| Interior Ambience | 60% |
| Magical Effects | 70% |

Music finals are mastered to **−18 LUFS integrated, −2 dBTP** to leave headroom for the other buses. Do not add normalization or a limiter on the Music bus that would undo that.

## Accessibility

- Every functional cue (brew complete, order ready, item picked up, error) has a visual equivalent: caption, icon pulse or controller haptic. **Audio is never the only signal that an action succeeded.**
- Captions for functional SFX are on by default; music is never captioned except an optional "Now playing: <title>" toast.
- Reduced-motion and sound-off play must remain fully functional (test pass required below).

## Asset storage

```
audio/music/originals/   untouched ElevenLabs downloads  (<ID>_<generation_id>.mp3) — never edited
audio/music/finals/      mastered 48 kHz 16-bit WAV used by the game
audio/music/rejects.json  rejected generations, by generation_id — never ship these
```
The game loads only from `finals/` and only IDs whose manifest `status` is `approved`.

## Quality gate (per track, before `approved`)

| # | Check | How |
|---|---|---|
| 1 | No clipping, no abrupt start/end | `qc_master.py` auto flags (`source_clipping_risk`, `loud_start`) + listen to first/last 10 s |
| 2 | No audible seams at loop/crossfade | play last 10 s → first 10 s at 0 s and 5 s crossfade |
| 3 | Balanced perceived loudness | final within ±1 LU of −18 LUFS (auto) + A/B against neighbours |
| 4 | No harsh HF fatigue on Quest headphones | `bright_hf_check` flag + 10 min listen on Quest at default volume |
| 5 | No voice / vocal artifacts | full listen; any hum/choir-like formant = reject |
| 6 | No copyrighted motifs / artist mimicry | listen for recognisable melodies; reject if any reviewer recognises one |
| 7 | Distinct from other tracks | shuffle-listen whole playlist; flag near-duplicates |
| 8 | Comfortable in seated VR | 20 min session, no fatigue |
| 9 | Sound-off & reduced-motion fully functional | play one full order loop with Master muted and reduced motion on |

Record the result in the manifest's `qc_listen_review` field (`pass` / `reject: <reason>`). On reject, move the generation_id into `rejects.json` and regenerate that one track.
