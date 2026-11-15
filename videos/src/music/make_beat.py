"""Original upbeat hip-hop bed for Yathin Looops promos (no samples, all synthesized)."""
import numpy as np, wave
SR=44100; BPM=100; beat=60/BPM; bars=16; N=int(SR*beat*4*bars)
out=np.zeros((N,2))
t_=lambda d: np.arange(int(SR*d))/SR
def add(sig,start,pan=0.0,g=1.0):
    i=int(start*SR); j=min(N,i+len(sig)); s=sig[:j-i]*g
    out[i:j,0]+=s*(1-max(0,pan)); out[i:j,1]+=s*(1+min(0,pan))
rng=np.random.default_rng(7)
def kick():
    t=t_(0.45); f=50+120*np.exp(-t*30); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t*7)+0.3*np.exp(-t*200)*rng.standard_normal(len(t))*0.2
def clap():
    t=t_(0.25); n=rng.standard_normal(len(t)); env=np.exp(-t*25)
    for k in (0.01,0.02): env+=np.where(t>k,np.exp(-(t-k)*60),0)*0.5
    # bandpass-ish: diff of noise
    n=np.convolve(n,[1,-0.6],'same'); return n*env*0.35
def hat(o=False):
    t=t_(0.18 if o else 0.05); n=rng.standard_normal(len(t)); n=np.diff(np.r_[0,n])
    return n*np.exp(-t*(18 if o else 90))*0.12
def m2f(m): return 440*2**((m-69)/12)
def bass(m,d):
    t=t_(d); f=m2f(m); s=np.sin(2*np.pi*f*t)+0.25*np.sin(4*np.pi*f*t)
    return np.tanh(1.8*s)*np.minimum(1,t*80)*np.exp(-t*1.2)*0.45
def stab(ms,d=0.22):
    t=t_(d); s=sum(np.sign(np.sin(2*np.pi*m2f(m)*t))*0.5+np.sin(2*np.pi*m2f(m)*1.003*t) for m in ms)
    s=np.convolve(s,np.ones(6)/6,'same')
    return s*np.exp(-t*9)*0.07
def pluck(m,d=0.18):
    t=t_(d); return np.sin(2*np.pi*m2f(m)*t)*np.exp(-t*14)*0.18
# progression (F# minor-ish bright: Am F C G style) -> A minor 4-chord loop
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]; roots=[33,29,36,31]
melody=[76,79,81,79,76,74,72,74]
for bar in range(bars):
    b0=bar*4*beat; c=bar%4; intro=bar<1
    for q in range(4):
        tq=b0+q*beat
        if not intro or q>=2:
            if q in (0,2): add(kick(),tq,g=0.9)
        if q in (1,3) and not intro: add(clap(),tq,g=1)
        for e in range(4):
            add(hat(o=(e==2 and q==3)),tq+e*beat/4,pan=0.3 if e%2 else -0.3)
    if bar%2==1 and not intro: add(kick(),b0+2.5*beat,g=0.7)
    if not intro:
        add(bass(roots[c],beat*1.5),b0); add(bass(roots[c],beat*0.5),b0+1.75*beat); add(bass(roots[c]+12,beat*0.9),b0+2.5*beat)
    for s in (0.5,1.5,2.75,3.5): add(stab(chords[c]),b0+s*beat,pan=-0.2 if s<2 else 0.2)
    if bar>=4 and bar%4 in (1,3):
        for k,m in enumerate(melody): add(pluck(m),b0+k*beat/2,pan=0.25)
out/=np.max(np.abs(out))*1.12
fade=int(SR*0.01); out[-fade:]*=np.linspace(1,0,fade)[:,None]
w=wave.open("yathin_hustle.wav","wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
print(N/SR,"s")
