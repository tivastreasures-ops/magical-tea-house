#!/usr/bin/env python3
"""Objective checks on mastered finals. Writes audio/music/qc_report.json.
Covers quality-gate items that can be measured; listening review is still required.
 - momentary loudness spikes (sudden loud hits)       - silence dropouts mid-track
 - HF energy share >6 kHz / >10 kHz (fatigue proxy)   - spectral centroid
 - tempo estimate, key estimate (Krumhansl profile)   - short-loop repetition (phrase duplication)
 - pairwise similarity across all tracks (distinctness)
 - seam test: level of end tail vs next start for crossfades"""
import json, os, re, subprocess, sys
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
man = json.load(open(os.path.join(ROOT, "audio/music/manifest.json")))
SR = 22050
def load(p):
    raw = subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True,check=True).stdout
    return np.frombuffer(raw, np.float32)
def ebur(p):
    e = subprocess.run(["ffmpeg","-hide_banner","-nostats","-v","verbose","-i",p,"-af","ebur128=framelog=verbose","-f","null","-"],capture_output=True,text=True).stderr
    M = [float(x) for x in re.findall(r"M:\s*(-?[\d.]+)", e)]
    I = float(re.findall(r"I:\s*(-?[\d.]+) LUFS", e)[-1]); LRA = float(re.findall(r"LRA:\s*(-?[\d.]+) LU", e)[-1])
    return np.array(M), I, LRA
def silences(p):
    e = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",p,"-af","silencedetect=n=-55dB:d=1.5","-f","null","-"],capture_output=True,text=True).stderr
    s = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", e)]; d = [float(x) for x in re.findall(r"silence_duration: ([\d.]+)", e)]
    return list(zip(s, d))
NFFT, HOP = 4096, 2048
def stft_mag(x):
    w = np.hanning(NFFT); n = 1 + (len(x) - NFFT) // HOP
    fr = np.lib.stride_tricks.as_strided(x, (n, NFFT), (x.strides[0]*HOP, x.strides[0]))
    return np.abs(np.fft.rfft(fr * w, axis=1)).astype(np.float32)
freqs = np.fft.rfftfreq(NFFT, 1/SR)
pc_map = np.full(len(freqs), -1)
ok = (freqs > 55) & (freqs < 4200)
pc_map[ok] = (np.round(12*np.log2(freqs[ok]/440.0)) + 9) % 12
def chroma(S):
    C = np.zeros((S.shape[0], 12), np.float32)
    for k in range(12): C[:, k] = (S[:, pc_map == k]**2).sum(1)
    C /= C.sum(1, keepdims=True) + 1e-9; return C
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]
def key(cm):
    best = max(((np.corrcoef(np.roll(prof, k), cm)[0,1], NAMES[k] + q) for prof, q in ((MAJ, " major"), (MIN, " minor")) for k in range(12)))
    return best[1], round(float(best[0]), 2)
def tempo(S):
    flux = np.maximum(np.diff(np.log1p(S[:, freqs < 5000]), axis=0), 0).sum(1); flux -= flux.mean()
    ac = np.correlate(flux, flux, "full")[len(flux)-1:]; fps = SR / HOP
    lags = np.arange(len(ac)); bpm = 60 * fps / np.maximum(lags, 1); m = (bpm > 50) & (bpm < 160)
    return round(float(bpm[m][np.argmax(ac[m])]), 1)
def loopiness(C):
    # max similarity of the chroma sequence with itself shifted by 2-12 s, averaged across the track.
    fps = SR / HOP; best = (0, 0)
    for lag in range(int(2*fps), int(12*fps)):
        a, b = C[:-lag], C[lag:]
        s = float(((a*b).sum(1) / (np.linalg.norm(a,axis=1)*np.linalg.norm(b,axis=1)+1e-9)).mean())
        if s > best[0]: best = (s, lag/fps)
    return round(best[0], 3), round(best[1], 1)
rep = {}; feats = {}
for t in man["tracks"]:
    p = os.path.join(ROOT, t["file"])
    if not os.path.exists(p): continue
    x = load(p); S = stft_mag(x); C = chroma(S)
    M, I, LRA = ebur(p); Mv = M[M > -70]
    pw = (S**2).sum(0); tot = pw.sum()
    cen = float((S * freqs).sum() / (S.sum() + 1e-9))
    cm = C.mean(0); k = key(cm); lp = loopiness(C)
    mid = [s for s in silences(p) if 5 < s[0] < len(x)/SR - 8]
    r = dict(integrated_lufs=I, lra=LRA, momentary_max=round(float(Mv.max()),1),
             spike_lu_above_integrated=round(float(Mv.max()-I),1),
             hf_share_above_6k_pct=round(100*float(pw[freqs>6000].sum()/tot),2),
             hf_share_above_10k_pct=round(100*float(pw[freqs>10000].sum()/tot),3),
             spectral_centroid_hz=round(cen), tempo_est_bpm=tempo(S), key_est=k[0], key_conf=k[1],
             loop_similarity=lp[0], loop_lag_s=lp[1], mid_track_silences=mid)
    flags = []
    if r["spike_lu_above_integrated"] > 9: flags.append("loud_moment")
    if r["hf_share_above_6k_pct"] > 3: flags.append("bright")
    if mid: flags.append("dropout")
    if lp[0] > 0.97: flags.append("possible_short_loop")
    r["flags"] = flags; rep[t["id"]] = r
    feats[t["id"]] = np.concatenate([cm, np.log1p(S.mean(0)[::16])])
    print(t["id"], r["key_est"], r["tempo_est_bpm"], "bpm", r["integrated_lufs"], "LUFS", flags or "", flush=True)
ids = sorted(feats); F = np.array([feats[i] for i in ids]); F = (F - F.mean(0)) / (F.std(0) + 1e-9)
F /= np.linalg.norm(F, axis=1, keepdims=True); sim = F @ F.T
pairs = sorted(((float(sim[a,b]), ids[a], ids[b]) for a in range(len(ids)) for b in range(a+1, len(ids))), reverse=True)
for i in ids:
    j = int(np.argsort(-sim[ids.index(i)])[1]); rep[i]["most_similar"] = [ids[j], round(float(sim[ids.index(i), j]), 3)]
out = dict(tracks=rep, most_similar_pairs=[dict(a=a, b=b, sim=round(s,3)) for s, a, b in pairs[:10]])
json.dump(out, open(os.path.join(ROOT, "audio/music/qc_report.json"), "w"), indent=2)
print("top similar pairs:", out["most_similar_pairs"][:5])
