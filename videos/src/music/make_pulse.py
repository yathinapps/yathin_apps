"""Original fitness-style EDM/house bed (C minor, 118 BPM, four-on-the-floor, sidechain pump, big sub).
All synthesized, no samples. Inspired by the energy of workout promo music, not copied from any track."""
import numpy as np, wave
SR=44100; BPM=118; beat=60/BPM; bars=24; N=int(SR*beat*4*bars)
out=np.zeros((N,2)); side=np.ones(N)
t_=lambda d: np.arange(int(SR*d))/SR
rng=np.random.default_rng(11)
def add(sig,start,pan=0.0,g=1.0,duck=False):
    i=int(start*SR); j=min(N,i+len(sig)); s=sig[:j-i]*g
    if duck: s=s*side[i:j]
    out[i:j,0]+=s*(1-max(0,pan)); out[i:j,1]+=s*(1+min(0,pan))
def m2f(m): return 440*2**((m-69)/12)
def kick():
    t=t_(0.38); f=49+150*np.exp(-t*35); ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(2.2*np.sin(ph)*np.exp(-t*6))*0.95+np.exp(-t*300)*rng.standard_normal(len(t))*0.08
def clap():
    t=t_(0.22); n=np.convolve(rng.standard_normal(len(t)),[1,-0.7],'same'); env=np.exp(-t*22)
    for k in (0.008,0.017,0.026): env+=np.where(t>k,np.exp(-(t-k)*70),0)*0.5
    return n*env*0.3
def hat(o=False):
    t=t_(0.16 if o else 0.04); n=np.diff(np.r_[0,rng.standard_normal(len(t))])
    return n*np.exp(-t*(20 if o else 110))*(0.14 if o else 0.07)
def saw(f,t,det=(0.993,1.0,1.007)):
    return sum(2*((f*d*t)%1)-1 for d in det)/len(det)
def lp(x,a): # one-pole lowpass, a in (0,1)
    y=np.empty_like(x); s=0.0
    for i,v in enumerate(x): s+=a*(v-s); y[i]=s
    return y
def bass(m,d):
    t=t_(d); f=m2f(m); s=np.sin(2*np.pi*f*t)*0.9+0.35*saw(f,t,(1.0,))
    return np.tanh(1.6*s)*np.minimum(1,t*200)*np.minimum(1,(d-t)*60)*0.42
def pad(ms,d):
    t=t_(d); s=sum(saw(m2f(m),t) for m in ms)/len(ms)
    return s*np.minimum(1,t*8)*np.minimum(1,(d-t)*8)*0.3
def lead(m,d):
    t=t_(d); s=saw(m2f(m),t,(0.995,1.005))+0.5*np.sign(np.sin(2*np.pi*m2f(m+12)*t))
    return s*np.exp(-t*7)*0.07
# sidechain envelope: duck on every beat
for k in range(int(bars*4)):
    i=int(k*beat*SR); L=int(beat*SR); tt=np.arange(L)/SR
    side[i:i+L]=np.minimum(side[i:i+L],1-0.85*np.exp(-tt*9)) if i+L<=N else side[i:i+L]
# C minor: Cm  Ab  Eb  Bb
chords=[[60,63,67],[56,60,63],[55,58,63],[58,62,65]]; roots=[36,32,39,34]
hook=[72,72,75,72,70,67,70,72, 72,72,75,77,75,72,70,67]
DROP=8  # bars 0-7 build, 8+ full drop
for bar in range(bars):
    b0=bar*4*beat; c=bar%4; build=bar<DROP; full=not build
    pd=pad(chords[c],4*beat)
    add(lp(pd,0.08 if build else 0.25),b0,pan=0,g=1.0,duck=True)
    for q in range(4):
        tq=b0+q*beat
        if full or bar>=2: add(kick(),tq,g=1.0)
        if (full or bar>=4) and q in (1,3): add(clap(),tq)
        for e in range(4):
            if full or bar>=2: add(hat(o=(e==2)),tq+e*beat/4,pan=0.25 if e%2 else -0.25,g=1.0 if e==2 else 0.8)
        if full or bar>=4:  # offbeat rolling bass
            add(bass(roots[c],beat*0.42),tq+beat/2,duck=True)
            if full: add(bass(roots[c]+12,beat*0.2),tq+0.75*beat,g=0.5,duck=True)
    if full and bar%2==0:
        for k,m in enumerate(hook): add(lead(m,beat/2),b0+k*beat/2,pan=0.15)
    if bar in (DROP-2,DROP-1):  # snare roll + white noise riser into the drop
        n=16 if bar==DROP-1 else 8
        for k in range(n): add(clap(),b0+k*4*beat/n,g=0.4+0.6*k/n)
    if bar==DROP-1:
        t=t_(4*beat); r=rng.standard_normal(len(t))*(t/t[-1])**2*0.25; add(r,b0)
out/=np.max(np.abs(out))*1.1
fade=int(SR*0.02); out[-fade:]*=np.linspace(1,0,fade)[:,None]
w=wave.open("yathin_pulse.wav","wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
print(N/SR,"s")
