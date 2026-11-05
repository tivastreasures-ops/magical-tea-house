#!/usr/bin/env python3
"""Download every ElevenLabs original listed in the manifest, keep it untouched in
audio/music/originals/, then QC + master into audio/music/finals/ and write the
measured loudness back into the manifest.

usage:  python3 tools/music/fetch_and_master.py [--manifest audio/music/manifest.json] [--only R01,G01]

Signed content URLs expire (~3 h after they are issued). If a download 403s, open the
track's `elevenlabs_song_url` in the manifest (ElevenLabs app > Music) and download the
MP3 manually into audio/music/originals/<ID>_<generation_id>.mp3, then re-run: existing
originals are never re-downloaded.
Requires: python3, ffmpeg/ffprobe on PATH."""
import argparse, json, os, subprocess, sys, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ap = argparse.ArgumentParser(); ap.add_argument("--manifest", default=os.path.join(ROOT, "audio/music/manifest.json"))
ap.add_argument("--only", default=""); a = ap.parse_args()
man = json.load(open(a.manifest)); only = set(filter(None, a.only.split(",")))
od, fd = os.path.join(ROOT, "audio/music/originals"), os.path.join(ROOT, "audio/music/finals")
os.makedirs(od, exist_ok=True); os.makedirs(fd, exist_ok=True)
for t in man["tracks"]:
    if only and t["id"] not in only: continue
    if t.get("status") == "rejected": continue
    orig = os.path.join(od, f"{t['id']}_{t['generation_id']}.mp3")
    if not os.path.exists(orig):
        try:
            urllib.request.urlretrieve(t["content_url"], orig); print("downloaded", t["id"])
        except Exception as e:
            print(f"{t['id']}: download failed ({e}); fetch manually from {t['elevenlabs_song_url']}", file=sys.stderr); continue
    final = os.path.join(fd, t["file"].split("/")[-1])
    r = json.loads(subprocess.check_output([sys.executable, os.path.join(HERE, "qc_master.py"), orig, final]))
    t.update(original_file=os.path.relpath(orig, ROOT), duration_s=r["duration_s"], loudness=r, qc_auto_flags=r["auto_flags"],
             status="mastered" if not r["auto_flags"] else "needs_listen_review")
    print(t["id"], r["final_lufs"], "LUFS", r["final_true_peak"], "dBTP", r["auto_flags"] or "ok")
json.dump(man, open(a.manifest, "w"), indent=2)
