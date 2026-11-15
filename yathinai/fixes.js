/* ---- bug fixes 2026-11-15: PBKDF2 passwords, birthdate check, long-message summary ---- */
window.YFix=(function(){
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function pbkdf2(pw,saltHex,iter){const salt=new Uint8Array(saltHex.match(/../g).map(h=>parseInt(h,16)));const k=await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},k,256))}
const ITER=150000;
const A=()=>JSON.parse(localStorage.getItem("yai-acc2")||"{}"),saveA=a=>localStorage.setItem("yai-acc2",JSON.stringify(a));
async function setPw(e,pw){const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const a=A();a[e]={s:salt,i:ITER,h:await pbkdf2(pw,salt,ITER)};saveA(a);const old=JSON.parse(localStorage.getItem("yai-accounts")||"{}");if(old[e]){delete old[e];localStorage.setItem("yai-accounts",JSON.stringify(old))}}
async function sha(t){return hex(await crypto.subtle.digest("SHA-256",enc.encode(t)))}
/* state of an email on this device: "pbkdf2" | "legacy" (old sha hash) | "nohash" (known, never had a password) | "new" */
function state(e){if(A()[e])return"pbkdf2";if(JSON.parse(localStorage.getItem("yai-accounts")||"{}")[e])return"legacy";const known=["yai-agefor","yai-pinfor","yai-plusfor","yai-gusers"].some(k=>{try{return e in JSON.parse(localStorage.getItem(k)||"{}")}catch(x){return false}});return known?"nohash":"new"}
async function check(e,pw){const s=state(e);if(s==="pbkdf2"){const r=A()[e];return(await pbkdf2(pw,r.s,r.i||ITER))===r.h}
 if(s==="legacy"){const ok=JSON.parse(localStorage.getItem("yai-accounts")||"{}")[e]===await sha(e+"|"+pw);if(ok&&pw.length>=8)await setPw(e,pw);return ok}return false}
function markGoogle(e){const m=JSON.parse(localStorage.getItem("yai-gusers")||"{}");m[e]=1;localStorage.setItem("yai-gusers",JSON.stringify(m))}
/* birthdate or age -> {age} or {err} */
function age(v){v=String(v||"").trim();if(!v)return{err:"Enter your birthday or your age."};
 if(/^\d{1,3}$/.test(v)){const n=+v;if(n<5||n>120)return{err:"Age must be between 5 and 120."};return{age:n}}
 const m=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return{err:"That isn't a real date. Use the date picker or type your age."};
 const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return{err:"That date doesn't exist. Check the day and month."};
 const now=new Date();if(dt>now)return{err:"Your birthday can't be in the future."};
 let a=now.getFullYear()-y;if(now.getMonth()<mo-1||(now.getMonth()===mo-1&&now.getDate()<d))a--;
 if(a<5)return{err:"You need to be at least 5 to use Yathin AI."};if(a>120)return{err:"That's more than 120 years ago. Check the year."};return{age:a}}
/* long or junk message -> short summary (null if normal) */
function summary(t){t=String(t||"");const s=t.replace(/\s+/g,"");if(!s)return null;
 const toks=t.trim().split(/\s+/),longest=toks.reduce((m,x)=>Math.max(m,x.length),0);
 const cnt={};for(const c of s)cnt[c]=(cnt[c]||0)+1;const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
 if(s.length>=40&&top[1]/s.length>=0.9)return`Long text: ${top[1]} ${top[0]}'s`;
 if(toks.length>=8){const tc={};toks.forEach(x=>tc[x]=(tc[x]||0)+1);const tt=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0];if(tt[1]/toks.length>=0.7)return`Long text: "${tt[0].slice(0,24)}" repeated ${tt[1]} times`}
 if(longest>=60&&longest/s.length>0.6)return`Long unbroken text (${t.length} characters) starting "${s.slice(0,18)}…"`;
 if(t.length>280){const first=(t.trim().split(/(?<=[.!?])\s/)[0]||"").slice(0,110);return`Long message (${toks.length} words): ${first}${first.length<t.trim().length?"…":""}`}
 return null}
const junk=t=>{const x=summary(t);return!!x&&!/^Long message/.test(x)};
/* put summary + Show full toggle in a user bubble; ai(text)->Promise<string> optional */
function decorate(d,t,ai,saved,onGist){const sm=summary(t);if(!sm)return;d.textContent="";d.classList.add("longmsg");
 const s=document.createElement("div");s.className="lsum";s.textContent=saved||sm;const f=document.createElement("div");f.className="lfull";f.textContent=t;f.hidden=true;
 const b=document.createElement("button");b.className="ltog";b.type="button";b.textContent="Show full";b.onclick=()=>{f.hidden=!f.hidden;b.textContent=f.hidden?"Show full":"Hide full"};d.append(s,f,b);
 if(!saved&&ai&&!junk(t)){ai(t).then(g=>{g=String(g||"").replace(/<think>[\s\S]*?<\/think>/g,"").replace(/^["'\s]+|["'\s]+$/g,"").split("\n")[0].slice(0,140);if(g){s.textContent="Long message: "+g;onGist&&onGist("Long message: "+g)}}).catch(()=>{})}}
return{pbkdf2,setPw,state,check,markGoogle,age,summary,decorate}})();
