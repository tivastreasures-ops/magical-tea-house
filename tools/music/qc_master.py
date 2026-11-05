"""QC + master one original. usage: qc_master.py <original> <final_out.wav>
Prints JSON: duration, input LUFS/TP/LRA, edge levels, HF ratio, final LUFS/TP."""
import json, re, subprocess, sys
TARGET_LUFS, TP = -18.0, -2.0   # quiet background-music target; leaves headroom for weather/SFX buses
FADE_IN, FADE_OUT = 1.5, 4.0

def run(args): return subprocess.run(args, capture_output=True, text=True).stderr
def loud(path, extra=""):
    af = (extra + "," if extra else "") + f"loudnorm=I={TARGET_LUFS}:TP={TP}:LRA=11:print_format=json"
    e = run(["ffmpeg","-hide_banner","-nostats","-i",path,"-af",af,"-f","null","-"])
    return json.loads(e[e.rindex("{"):e.rindex("}")+1])
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
def rms_db(p, ss, t, af=None):
    a=["ffmpeg","-hide_banner","-nostats","-ss",str(ss),"-t",str(t),"-i",p]
    a+=["-af",(af+"," if af else "")+"astats=metadata=0:reset=0","-f","null","-"]
    m=re.findall(r"RMS level dB:\s*(-?[\d.]+|-inf)", run(a)); return float(m[-1]) if m and m[-1]!="-inf" else -120.0
def peak_db(p):
    m=re.findall(r"Peak level dB:\s*(-?[\d.]+)", run(["ffmpeg","-hide_banner","-nostats","-i",p,"-af","astats","-f","null","-"]))
    return float(m[-1])

src, out = sys.argv[1], sys.argv[2]
d = dur(src); m = loud(src)
full = rms_db(src,0,d); hf = rms_db(src,0,d,"highpass=f=6000")
r = dict(duration_s=round(d,2), src_lufs=float(m["input_i"]), src_true_peak=float(m["input_tp"]), src_lra=float(m["input_lra"]),
         src_sample_peak_db=peak_db(src),
         first_0_5s_rms=rms_db(src,0,0.5), last_0_5s_rms=rms_db(src,d-0.5,0.5), body_rms=full,
         hf_above_6k_rel_db=round(hf-full,1))
af = (f"loudnorm=I={TARGET_LUFS}:TP={TP}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
      f"afade=t=in:d={FADE_IN},afade=t=out:st={d-FADE_OUT:.2f}:d={FADE_OUT},aresample=48000")
subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-i",src,"-af",af,"-c:a","pcm_s16le","-ar","48000",out],check=True)
f = loud(out); r.update(final_lufs=float(f["input_i"]), final_true_peak=float(f["input_tp"]), final_sample_peak_db=peak_db(out))
flags=[]
if r["src_sample_peak_db"] > -0.1: flags.append("source_clipping_risk")
if r["final_true_peak"] > -1.0: flags.append("final_true_peak_high")
if r["first_0_5s_rms"] > r["body_rms"]+3: flags.append("loud_start")
if abs(r["final_lufs"]-TARGET_LUFS) > 1.0: flags.append("loudness_off_target")
if r["hf_above_6k_rel_db"] > -12: flags.append("bright_hf_check")
if d < 120: flags.append("short")
r["auto_flags"]=flags
print(json.dumps(r))
