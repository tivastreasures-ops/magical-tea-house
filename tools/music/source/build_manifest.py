"""Build audio/music/manifest.json (+ per-playlist CSVs) from prompts, node map, generation IDs, links."""
import csv, json, os, sys
src = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
P = json.load(open(f"{src}/prompts.json")); G = json.load(open(f"{src}/gens.json"))
L = json.load(open(f"{src}/links.json")) if os.path.exists(f"{src}/links.json") else {}
N = json.load(open(f"{src}/nodes.json"))
node = {f"{c}{t}": nid for t, ids in N["nodes"].items() for c, nid in zip("RGSW", ids)}
slug = lambda s: "".join(ch.lower() if ch.isalnum() else "_" for ch in s).strip("_").replace("__", "_")
tracks = []
for p in P:
    sid, gid = G[p["id"]]; l = L.get(p["id"], {})
    tracks.append(dict(id=p["id"], track_number=int(p["id"][1:]), title=p["title"], mood=p["mood"], prompt=p["prompt"],
        model="eleven_music_v2_5", params=dict(duration_seconds=180, lyrics_type="instrumental", instrumental=True),
        requested_duration_s=180, duration_s=l.get("duration_s"), generation_id=gid, session_id=sid, flow_node_id=node[p["id"]],
        seed=None, seed_note="ElevenLabs Music does not expose a seed; generation_id is the version identifier",
        credit_cost=2699.4, usd_cost=0.4908, status=l.get("status", "generated_not_downloaded"),
        elevenlabs_song_url=l.get("song_url"), content_url=l.get("content_url"),
        file=f"audio/music/finals/{p['id']}_{slug(p['title'])}.wav", original_file=None,
        loudness=None, playback_loudness_target_lufs=-18.0, true_peak_ceiling_dbtp=-2.0, qc_auto_flags=None, qc_listen_review=None))
man = dict(project="Magical Tea Tent", flow_url=f"https://elevenlabs.io/app/flows/{N['flow_id']}",
    generator="ElevenLabs Music v2.5 via ElevenLabs Flows", generated_on="2026-11-05",
    playlists={m: [t["id"] for t in tracks if t["mood"] == m] for m in ["Rainy Twilight","Golden Garden","Starlit Night","Winter Refuge"]},
    tracks=tracks)
os.makedirs(os.path.dirname(out), exist_ok=True); json.dump(man, open(out, "w"), indent=2)
for m, ids in man["playlists"].items():
    with open(os.path.join(os.path.dirname(out), "playlists", slug(m) + ".csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["track","id","title","duration_s","file","generation_id","credit_cost","status","prompt"])
        for t in tracks:
            if t["mood"] == m: w.writerow([t["track_number"],t["id"],t["title"],t["duration_s"],t["file"],t["generation_id"],t["credit_cost"],t["status"],t["prompt"]])
print("tracks", len(tracks))
