"""Record narrated demo videos for Yathin Apps (runs in GitHub Actions)."""
import asyncio, functools, glob, http.server, json, os, shutil, subprocess, threading, time
import edge_tts
from playwright.sync_api import sync_playwright

VOICE = "en-US-AvaNeural"
ROOT = os.path.abspath(".")
os.makedirs("out", exist_ok=True)

h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8811), h)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


async def tts(text, path):
    await edge_tts.Communicate(text, VOICE, rate="+4%").save(path)


def say(t, path, voice=VOICE, rate="+10%"):
    for k in range(8):
        r = subprocess.run(["edge-tts", "--voice", voice, f"--rate={rate}", "--text", t, "--write-media", path])
        if r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 1000: return
        time.sleep(3 + 2 * k)
    raise SystemExit("TTS failed: " + t)


def lines_for(sc):
    out = []
    for s in sc["scenes"]:
        if s.get("hook"): out.append(s["hook"])
        elif s.get("end"): out.append(f'{sc["title"]}. Free on Yathin Apps.')
        else: out.append(s.get("cap", ""))
    return out


def run(app):
    work = f"work_{app}"; os.makedirs(work, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        W, H = (1080, 1920) if "vertical" in app else (1920, 1080)
        ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=f"vid_{app}",
                            record_video_size={"width": W, "height": H})
        pg = ctx.new_page(); t_page = time.time()
        pg.goto(f"http://127.0.0.1:8811/videos/src/director.html?app={app}", wait_until="networkidle")
        sc = pg.evaluate("S")
        lines = sc["lines"]
        clips = []
        rap = sc.get("rap")
        if rap:  # rap track replaces narration: one bar per line on a fixed grid
            BAR = 240.0 / sc.get("bpm", 100); rv = rap.get("voice", "en-US-AndrewNeural"); rr = rap.get("rate", "+18%")
            rl, starts, k = [], [], rap.get("lead", 1)
            for sl in rap["scenes"]:
                starts.append(k * BAR)
                for ln in sl: rl.append((k * BAR, ln)); k += 1
            for j, (at, ln) in enumerate(rl):
                pth = f"{work}/r{j}.mp3"; say(ln, pth, rv, rr); dd = dur(pth); f = max(1.0, dd / (BAR - 0.12))
                clips.append((pth, at, f))
            ends = starts[1:] + [k * BAR + 1.0]
            durs = []
            for i, s0 in enumerate(sc["scenes"]):
                L = ends[i] - (0 if i == 0 else starts[i])
                if s0.get("hook"): L -= 1.35
                durs.append(max(1.0, L - 0.5))
        else:
          for i, t in enumerate(lines):
            path = f"{work}/n{i}.mp3"; say(t, path, sc.get("voice", VOICE), sc.get("rate", "+10%")); clips.append(path)
          durs = [dur(c) for c in clips]
        pg.wait_for_timeout(500)
        t_go = time.time()
        pg.evaluate(f"start({json.dumps(durs)})")
        pg.wait_for_function("window.__done === true", timeout=180000, polling=200)
        marks = pg.evaluate("window.__marks"); total = pg.evaluate("window.__total")
        ctx.close(); b.close()
    raw = glob.glob(f"vid_{app}/*.webm")[0]
    off = t_go - t_page
    # narration track: each clip delayed to its scene start (+250 ms)
    inputs, filt = [], []
    if sc.get("rap"):
        for i, (c, at, f) in enumerate(clips):
            inputs += ["-i", c]; d = int(at * 1000)
            filt.append(f"[{i}:a]aresample=44100,atempo={f:.3f},acompressor=threshold=0.1:ratio=4,aecho=0.8:0.5:90:0.18,adelay={d}|{d},volume=1.5[a{i}]")
    else:
      for i, (c, m) in enumerate(zip(clips, marks)):
        inputs += ["-i", c]; d = int(m) + 250
        filt.append(f"[{i}:a]aresample=44100,adelay={d}|{d},volume=1.6[a{i}]")
    n = len(clips); T = total / 1000.0
    ch = sc.get("chant")
    if ch:  # hype ad-libs: a shout on each scene change, a chant over the end card
        cv = ch.get("voice", "en-US-AndrewNeural"); shouts = ch.get("shouts", ["Hey!"]); k = n
        cues = [(marks[i] / 1000.0 - 0.3, shouts[(i - 1) % len(shouts)], ch.get("gain", 0.55)) for i in range(1, len(marks))]
        if ch.get("outro"): cues.append((marks[-1] / 1000.0 + durs[-1] + 0.45, ch["outro"], 1.0))
        for j, (at, txt, g) in enumerate(cues):
            if at < 0 or at > T - 0.4: continue
            pth = f"{work}/c{j}.mp3"; say(txt, pth, cv, ch.get("rate", "+20%"))
            inputs += ["-i", pth]; d = int(at * 1000)
            filt.append(f"[{k}:a]aresample=44100,asetrate=44100*0.94,aresample=44100,aecho=0.8:0.6:120:0.25,adelay={d}|{d},volume={g}[a{k}]"); k += 1
        n = k
    music = (f"aevalsrc='0.5*sin(2*PI*130.81*t)+0.35*sin(2*PI*196*t)+0.3*sin(2*PI*246.94*t)+0.25*sin(2*PI*329.63*t)':s=44100:d={T:.2f},"
             f"tremolo=f=0.25:d=0.5,lowpass=f=900,volume=0.05,afade=t=in:d=1.5,afade=t=out:st={max(0,T-2):.2f}:d=2[m]")
    if sc.get("music"):
        inputs += ["-stream_loop", "-1", "-i", f"videos/src/music/{sc['music']}"]
        music = (f"[{n}:a]aresample=44100,atrim=0:{T:.2f},volume={sc.get('musicVol', 0.22)},"
                 f"afade=t=in:d=0.4,afade=t=out:st={max(0,T-2):.2f}:d=2[m]")
    filt.append(music)
    mix = "".join(f"[a{i}]" for i in range(n)) + f"[m]amix=inputs={n+1}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11[aout]"
    filt.append(mix)
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[aout]", "-t", f"{T:.2f}", f"{work}/audio.m4a"], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{off:.3f}", "-i", raw, "-i", f"{work}/audio.m4a",
                    "-t", f"{T:.2f}", "-map", "0:v", "-map", "1:a", "-vf", "fps=30,format=yuv420p",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", f"out/{app}-demo.mp4"], check=True)
    print(app, "done", round(T, 1), "s; offset", round(off, 2))


for a in os.environ.get("VIDEO_APPS", "plantdoc fridgechef classview yathin").split():
    run(a)
