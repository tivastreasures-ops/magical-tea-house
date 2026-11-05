import json,os,sys
f=os.path.dirname(os.path.abspath(__file__))+"/../manifests/links.json"
L=json.load(open(f)) if os.path.exists(f) else {}
G=json.load(open(os.path.dirname(f)+"/gens.json"))
W="bb65dccf37d1496592126cc038d4c7c0"
for line in sys.stdin.read().split():
    tid,proj,song,sig=line.split("|")
    sid,gid=G[tid]
    L[tid]=dict(status="generated_not_downloaded",duration_s=180,
      song_url=f"https://elevenlabs.io/app/music/project/{proj}?selectedSongId={song}",
      content_url=f"https://elevenlabsusercontent.com/database/workspace/{W}/content_generation/{sid}/{gid}/content.mp3?Expires=1793872800&KeyName=assets-cdn-key-1&Signature={sig}")
json.dump(L,open(f,"w"),indent=1); print(len(L),"tracks linked")
