/* Yathin AI next — main app (preview build) */
import { $, $$, esc, el, md, stripThink, getJson, fmtLeft, sha, loadScript } from "./util.js";
import { mountIDE } from "./code.js?v=5";
import { show3D, simulate } from "./scene.js?v=3";
import { MODEL3D, ARCH } from "./prompts3d.js";

const BRAIN = "https://yathin-ai.yathinlooops.workers.dev";
const L = localStorage, SS = sessionStorage;
const getJ = (k, d) => { try { const v = JSON.parse(L.getItem(k)); return v == null ? d : v } catch (e) { return d } };
const setJ = (k, v) => { try { L.setItem(k, JSON.stringify(v)) } catch (e) { toast("Storage is full. Clear some old chats.") } };
const user = () => { const u = L.getItem("yai-user"); return u && u !== "guest" ? u : null };
const guest = () => !user();
const sessTok = () => { const s = getJ("yai2-sess", null); return s && s.u === user() && s.x > Date.now() ? s.t : undefined }; // worker-signed proof of a Google sign-in
async function linkGoogle(cred, email) { try { const r = await fetch(BRAIN, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ v: 2, mode: "auth", credential: cred }) }); const j = await r.json(); if (j.ok && j.session) setJ("yai2-sess", { u: (j.email || email), t: j.session, x: Date.now() + (j.days || 30) * 864e5 - 36e5 }) } catch (e) { } }
const K = k => `yai2-${k}-${user() || "guest"}`;
const isKid = () => !!user() && getJ("yai-agefor", {})[user()] === 1;
const plan = () => "free"; // Yathin AI+ is coming soon: there is no way to unlock it yet
const WAIT = { free: 12 * 3600e3, plus: 2 * 864e5 };
const GUEST_MAX = 15;
const LIM = { chat: 20 * 3600, code: 14 * 3600 }; // existing Free usage limit (active seconds), now with a 12 h wait after it runs out

const KID = " The user is a child in Kids Mode for Learning. Use simple words, short friendly answers and a warm tone. No scary, violent, adult, dating, drug, gambling or other grown-up topics: if asked, kindly say it is not a kids topic and suggest a fun related thing to learn instead. Never ask for personal info. Do not tell them to ask a parent in normal answers; only for real safety matters (health, danger, money, meeting people online) gently suggest a trusted grown-up.";
const KIDBAD = /\b(sex\w*|porn\w*|nude|naked|suicide|self-harm|drugs?|weed|vape|vaping|alcohol|beer|vodka|cigarettes?|guns?|bombs?|gambl\w*|casino|dating|boyfriend|girlfriend)\b/i;
const KID_REDIRECT = "That's not a kids topic, so let's pick something else! 🌟 How about animals, space, dinosaurs or a fun science fact?";
const GAMESYS = 'Reply ONLY with JSON: {"title":"short title","kind":"quiz" or "match","questions":[{"q":"question","choices":["a","b","c","d"],"answer":0,"why":"one-line explanation"}],"pairs":[["term","meaning"]]}. For a quiz give 5 to 8 questions with exactly 4 choices and the index of the right one; for a match game give 5 or 6 short pairs. Use quiz unless the user asks for matching. Facts must be correct.';
const SIMRE = /\b(simulat\w*|drop|throw|launch|orbit\w*|solar system|bounce|collid\w*|collision|pendulum|projectile|build (a|an|the)\b|scene|gravity on|mars gravity|moon gravity)\b/i;

const TABS = [["home", "🏠", "Home"], ["chat", "💬", "Chat"], ["code", "</>", "Code"], ["3d", "🧊", "3D"], ["physics", "🪐", "Physics"], ["learn", "📚", "Learn"], ["games", "🎮", "Games"], ["shop", "🛍️", "Shopping"]];
const GUEST_OK = ["home", "chat"], KID_NO = ["code", "shop"];
let tab = L.getItem("yai2-tab") || "chat";
let busy = false, stopFn = null, ide = null, sim = null, att = null, lastAct = 0;

/* ---------------- toast ---------------- */
function toast(t) { const d = el("div", { style: "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#1e1b2e;color:#fff;padding:10px 16px;border-radius:14px;z-index:90;max-width:90vw;font-size:14px" }, t); document.body.append(d); setTimeout(() => d.remove(), 3200) }

/* ---------------- device id + guest limit (localStorage + IndexedDB copy) ---------------- */
function idb() { return new Promise(res => { try { const r = indexedDB.open("yai2", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => res(null) } catch (e) { res(null) } }) }
async function idbGet(k) { const db = await idb(); if (!db) return null; return new Promise(res => { try { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null) } catch (e) { res(null) } }) }
async function idbSet(k, v) { const db = await idb(); if (!db) return; try { db.transaction("kv", "readwrite").objectStore("kv").put(v, k) } catch (e) { } }
let GL = { id: "", n: 0, hit: 0 };
async function loadGuest() {
  const a = getJ("yai2-guestlim", null), b = await idbGet("guestlim");
  const id = (a && a.id) || (b && b.id) || L.getItem("yai2-dev") || ("d" + crypto.getRandomValues(new Uint32Array(2)).join(""));
  GL = { id, n: Math.max(a && a.id === id ? a.n : 0, b && b.id === id ? b.n : 0, a ? a.n : 0, b ? b.n : 0), hit: Math.max(a ? a.hit || 0 : 0, b ? b.hit || 0 : 0) };
  L.setItem("yai2-dev", id); saveGuest();
}
function saveGuest() { setJ("yai2-guestlim", GL); idbSet("guestlim", GL) }
/* limitHitAt per account (guest accounts are keyed by device id) */
const acctKey = () => user() || ("guest:" + GL.id);
function hitAt() { return getJ("yai2-limithit", {})[acctKey()] || (guest() ? GL.hit : 0) }
function setHit(ts) { const m = getJ("yai2-limithit", {}); m[acctKey()] = ts; setJ("yai2-limithit", m); if (guest()) { GL.hit = ts; saveGuest() } }
function lockedUntil() {
  const h = hitAt(); if (!h) return 0; const until = h + WAIT[plan()];
  if (Date.now() >= until) { const m = getJ("yai2-limithit", {}); delete m[acctKey()]; setJ("yai2-limithit", m); if (guest()) { GL = { id: GL.id, n: 0, hit: 0 }; saveGuest() } else setJ(K("use"), { chat: 0, code: 0 }); return 0 }
  return until;
}
const offlineOnly = () => SS.getItem("yai2-offnow") === "1" || L.getItem("yai2-offline") === "1" || L.getItem("yai2-online") === "0";
/* Free usage time: only real activity counts (typing in the last 60 s, or the AI working) */
const bucket = t => t === "code" || t === "3d" ? "code" : "chat";
setInterval(() => { if (guest() || tab === "home" || document.hidden || (Date.now() - lastAct > 60000 && !busy) || lockedUntil()) return; const u = getJ(K("use"), { chat: 0, code: 0 }); const b = bucket(tab); u[b] = (u[b] || 0) + 5; setJ(K("use"), u); if (u[b] >= LIM[b]) setHit(Date.now()) }, 5000);

/* ---------------- history + rolling cross-tab memory ---------------- */
const hist = t => getJ(K("hist-" + t), []);
const saveHist = (t, h) => setJ(K("hist-" + t), h.slice(-60));
const memText = () => getJ(K("mem"), []).join("\n");
function addMem(t, q, a) { const m = getJ(K("mem"), []); m.push(`[${t}] ${String(q).replace(/\s+/g, " ").slice(0, 110)} → ${stripThink(a).replace(/[`#*|]/g, "").replace(/\s+/g, " ").slice(0, 150)}`); setJ(K("mem"), m.slice(-12)) }

/* ---------------- brains ---------------- */
let engine = null, webllm = null;
async function ensureLocal(st) {
  if (engine) return;
  if (!navigator.gpu) throw new Error("This browser can't run the offline model (it needs WebGPU, for example in Chrome or Edge on a computer).");
  st && st("Getting the offline browser model…");
  webllm = webllm || await import("https://esm.run/@mlc-ai/web-llm");
  engine = await webllm.CreateMLCEngine("Qwen2.5-1.5B-Instruct-q4f16_1-MLC", { initProgressCallback: r => st && st("Downloading offline model " + Math.round((r.progress || 0) * 100) + "%") });
  L.setItem("yai2-localready", "1");
}
async function local(sys, msgs, st) { await ensureLocal(st); st && st("Thinking offline…"); const r = await engine.chat.completions.create({ messages: [{ role: "system", content: sys || "You are Yathin AI, a helpful assistant." }, ...msgs.slice(-12)], max_tokens: 1500, temperature: .6 }); return stripThink(r.choices[0].message.content || "") }
async function ollama(sys, msgs) {
  const r = await fetch("http://localhost:11434/api/chat", { method: "POST", body: JSON.stringify({ model: L.getItem("yai2-olm") || "llama3.2", stream: false, messages: [{ role: "system", content: sys || "You are Yathin AI." }, ...msgs.slice(-12)] }) });
  if (!r.ok) throw new Error("Ollama said no. Is the model pulled and is OLLAMA_ORIGINS=* set?"); const j = await r.json(); return stripThink(j.message && j.message.content || "");
}
class LimitErr extends Error { constructor(until) { super("limit"); this.until = until } }
/* one call = last 12 messages of this tab + the cross-tab summary; the worker adds the hidden planning prompt */
async function ask(mode, msgs, signal, extra) {
  extra = extra || {};
  let sys = extra.system || ""; if (isKid()) sys += KID;
  const until = lockedUntil(); if (until && !offlineOnly()) throw new LimitErr(until);
  if (L.getItem("yai2-ollama") === "1") return ollama(sys, msgs);
  if (offlineOnly()) return local(sys, msgs, pill);
  const body = { v: 2, mode, signedIn: !guest(), auth: sessTok(), messages: [...(sys ? [{ role: "system", content: sys }] : []), ...msgs.slice(-12).map(m => ({ role: m.role, content: m.content }))], summary: memText() };
  if (extra.image) body.image = extra.image;
  let r;
  try { r = await fetch(BRAIN, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body), signal }) }
  catch (e) { if (signal && signal.aborted) throw e; return fallback(sys, msgs, "I couldn't reach the online AI.") }
  if (r.status === 429) { const j = await r.json().catch(() => ({})); const reset = +j.resetAt || Date.now() + WAIT[plan()]; setHit(reset - WAIT[plan()]); throw new LimitErr(reset) }
  if (r.status === 403) { const j = await r.json().catch(() => ({})); if (j.error === "login_required") { openLogin(); throw new Error("Log in to unlock this mode.") } }
  if (!r.ok) return fallback(sys, msgs, "The online AI is busy right now.");
  const txt = await r.text(); let out = "";
  for (const line of txt.split("\n")) { if (!line.startsWith("data:")) continue; const d = line.slice(5).trim(); if (d === "[DONE]") break; try { const j = JSON.parse(d); out += j.choices?.[0]?.delta?.content || "" } catch (e) { } }
  out = stripThink(out); if (!out) return fallback(sys, msgs, "The online AI sent an empty answer.");
  return out;
}
async function fallback(sys, msgs, why) {
  if (engine || L.getItem("yai2-localready") === "1") { pill("Switching to the offline browser model…"); return local(sys, msgs, pill) }
  throw new Error(why + " Try again in a minute, or turn on the offline browser model in Advanced / Offline Settings.");
}
const errText = e => e instanceof LimitErr ? "" : (e && e.name === "AbortError" ? "Stopped." : (e && e.message || String(e)));

/* ---------------- header, tabs, banners ---------------- */
function drawTabs() {
  const n = $("#tabs"); n.innerHTML = "";
  TABS.forEach(([id, ic, name]) => { const locked = (guest() && !GUEST_OK.includes(id)) || (isKid() && KID_NO.includes(id));
    n.append(el("button", { class: (id === tab ? "on " : "") + (locked ? "lock" : ""), "data-t": id, "aria-label": name + (locked ? " (locked)" : ""), onclick: () => go(id) }, `${ic} ${name}`)) });
  $("#guestBar").classList.toggle("hidden", !guest());
  $("#kidBar").classList.toggle("hidden", !isKid());
  const nm = L.getItem("yai-name") || ""; $("#meBtn").textContent = guest() ? "👤" : (nm[0] || user()[0] || "Y").toUpperCase();
}
function go(id) {
  if (guest() && !GUEST_OK.includes(id)) { openLogin("Log in to unlock " + TABS.find(t => t[0] === id)[2] + "."); return }
  if (isKid() && KID_NO.includes(id)) { toast("That tab is off in Kids Mode for Learning."); return }
  tab = id; L.setItem("yai2-tab", id); drawTabs(); render(); $("#main").scrollTop = 0; window.scrollTo(0, 0);
}
$("#guestBar").onclick = () => openLogin();
$("#brand").onclick = () => go("chat");

/* ---------------- views ---------------- */
const HERO = () => `<section class="hero"><img src="yathinai_logo.svg" alt="Yathin AI logo">
 <h1><em>Yathin AI</em> — Instant, All-in-One AI for Chat, Code, 3D, Physics, Learning &amp; Games.</h1>
 <p class="by">Part of Yathin Looops (<a href="https://yathinlooops.pages.dev/">yathinlooops.pages.dev</a>) · Created by Yathin Pedamallu</p>
 <p class="lead">Open the page and start creating in one click—no complex setup walls, no API keys, and no technical settings in your way. Unlike ordinary text-only chatbots, Yathin AI combines frontier open-weight intelligence with custom-built interactive engines that turn your prompts into live 3D worlds, real-time physics simulations, working code, and playable study games right inside your browser—complete with a dedicated Kids Mode for Learning.</p></section>`;
const PLANS = () => `<section class="plans" id="plans"><h2>Choose Your Plan</h2><div class="pgrid">
 <div class="plan"><img src="yathinai_logo.svg" alt=""><h3>Free</h3><span class="tag">Free Forever</span><ul>
  <li>Instant guest access plus one-click login to unlock 3D, Physics, Code, and Chat with custom Home panels</li>
  <li>Smart online AI mode on by default with offline browser fallback</li>
  <li>Access to Chat, Code, 3D, Physics, Learn, and Games once signed in</li>
  <li>Built-in Kids Mode for Learning with parent PIN protection</li>
  <li>Generous daily use: 20 h of Chat and 14 h of Code · <span class="reset">Limits reset 12 hours after you run out</span></li></ul></div>
 <div class="plan plus"><img src="yathinai_plus_logo.svg" alt=""><h3>Yathin AI+</h3><span class="tag">Coming Soon</span>
  <p style="margin:10px 0 4px">Everything in Free, with a <b style="color:#d99a00;font-weight:800">better</b>, more <b style="color:#d99a00;font-weight:800">advanced</b> AI.</p>
  <div class="prices" style="display:flex;gap:22px;flex-wrap:wrap;margin:8px 0 2px">
   <div><b style="color:#d99a00;font-weight:800;font-size:26px">$15.99</b> <span>per month</span><br><s style="color:#9ca3af">$35.99</s></div>
   <div><b style="color:#d99a00;font-weight:800;font-size:26px">$55.99</b> <span>per year</span><br><s style="color:#9ca3af">$300.99</s></div></div><ul>
  <li>Instant guest access plus one-click login to unlock 3D, Physics, Code, and Chat with custom Home panels</li>
  <li>Smart online AI mode on by default with offline browser fallback</li>
  <li>Access to Chat, Code, 3D, Physics, Learn, and Games once signed in</li>
  <li>Built-in Kids Mode for Learning with parent PIN protection</li>
  <li>5x Larger AI Brain</li>
  <li>Huge Monthly Limits: <b style="color:#d99a00;font-weight:800">140</b> hours of Chat and <b style="color:#d99a00;font-weight:800">130</b> hours of Code every month with no daily caps · <span class="reset">Limits reset 2 days after you run out</span></li>
  <li>Prompt-to-Scene 3D &amp; Physics Builder</li>
  <li>One-Click "Explain &amp; Spawn" Lessons</li>
  <li>Cloud Sync &amp; Project Exports (.zip / .stl)</li></ul>
  <button class="btn" disabled style="opacity:.6;width:100%;margin-top:10px">Coming Soon</button></div></div></section>`;
const EX = { chat: ["Tell me a fun fact about space", "What's new in AI this week?", "Help me plan a study schedule"], code: ["Make a to-do app with local storage", "Python fizzbuzz with tests", "Make a snake game"], "3d": ["A small rocket", "A phone stand", "A castle with 4 towers"], physics: ["Simulate Mars gravity", "Build a solar system", "A ball falls from 20 m. How long to land?"], learn: ["How do volcanoes work?", "Explain photosynthesis", "What caused World War I?"], games: ["Make a quiz about the planets", "A matching game for French animal words"], shop: ["Best wireless earbuds under $100", "Laptop for a student under $700", "Kid-friendly tablet under $200"] };
const PH = { chat: "Message Yathin AI", code: "Describe an app, game or Python script", "3d": "Describe something to build in 3D", physics: "Ask a physics question or say “Simulate Mars gravity”", learn: "What do you want to learn?", games: "Make a game about…", shop: "What are you shopping for? Add a budget", home: "Message Yathin AI" };

/* info pill (What it does / Plans) */
document.querySelectorAll(".pill [data-info]").forEach(b => b.onclick = () => {
  const d = document.createElement("div"); d.id = "infoBox";
  d.innerHTML = `<div><button class="x" aria-label="Close">✕</button>${b.dataset.info === "plans" ? PLANS() : HERO()}</div>`;
  d.onclick = e => { if (e.target === d || e.target.classList.contains("x")) d.remove() };
  document.body.appendChild(d);
});
let CL = null;

/* about-only page: show what Yathin AI does + plans, with a button to the real AI */
function renderAbout() {
  const M = $("#main"); if (!M) return;
  M.innerHTML = HERO().replace("</section>", `<p style="text-align:center;margin:18px 0 0"><a class="btn" href="../yathinai/" style="display:inline-block;padding:12px 26px;border-radius:999px;background:var(--grad);color:#fff;font-weight:700;text-decoration:none">Open Yathin AI</a></p></section>`) + PLANS() + `<footer>Yathin AI · Part of Yathin Looops · Created by Yathin Pedamallu · <a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a></footer>`;
}
function render() { if (!window.YAI_APP) return renderAbout();

  const M = $("#main"); sim = null; ide = null; M.innerHTML = "";
  $("#q").placeholder = PH[tab] || "Message Yathin AI"; $("#composer").classList.remove("hidden");
  if (tab === "home") return renderHome(M);
  if (tab === "code") { M.innerHTML = `<div class="split"><div><div class="chatlist" id="cl"></div></div><div class="ide card" id="ide"></div></div>`; CL = $("#cl"); ide = mountIDE($("#ide"), ideCtx); drawHist(); return }
  if (tab === "3d" || tab === "physics") {
    M.innerHTML = `<div class="split"><div><div class="chatlist" id="cl"></div></div><div class="ide"><div class="stage" id="stage"><div style="display:grid;place-items:center;height:100%;color:#6b6880;text-align:center;padding:20px">${tab === "3d" ? "Your 3D model appears here. Spin it, then download the STL." : "Simulations appear here. Try “Simulate Mars gravity” or “Build a solar system”."}</div></div><div id="stageUI"></div></div></div>`;
    CL = $("#cl"); drawHist(); const last = [...hist(tab)].reverse().find(m => m.role === "assistant" && m.data); if (last) (tab === "3d" ? open3D : openSim)(last.data, false); return }
  if (tab === "games") { M.innerHTML = `<div class="split"><div><div class="chatlist" id="cl"></div></div><div class="ide"><div class="card" id="gList"></div><div class="card qz" id="gPlay" style="margin-top:10px"></div></div></div>`; CL = $("#cl"); drawHist(); drawGames(); return }
  M.innerHTML = `<div class="chatlist" id="cl"></div>`; CL = $("#cl"); drawHist();
}
function drawHist() {
  const h = hist(tab); CL.innerHTML = "";
  if (!h.length) { if (tab === "chat") CL.insertAdjacentHTML("beforeend", HERO()); else CL.insertAdjacentHTML("beforeend", `<div class="hero" style="padding:20px 6px"><img src="yathinai_logo.svg" alt="" style="width:56px;height:56px"><h1 style="font-size:26px">${{ code: "What should we build?", "3d": "What should we build in 3D?", physics: "Physics lab", learn: "What do you want to learn?", games: "Learning games", shop: "Smart shopping helper" }[tab]}</h1></div>`);
    const ex = el("div", { class: "ex" }); (EX[tab] || []).forEach(t => ex.append(el("button", { class: "chip", onclick: () => { $("#q").value = t; send() } }, t))); CL.append(ex);
    if (tab === "chat") CL.insertAdjacentHTML("beforeend", PLANS()); }
  h.forEach(m => { const b = bubble(m.role === "user" ? "u" : "a", m.show || m.content, m); if (m.role !== "user") afterAnswer(b, m) });
  const until = lockedUntil(); if (until && !offlineOnly()) lockCard(until);
}
function bubble(cls, t, m) {
  const d = el("div", { class: "msg " + cls });
  if (cls === "u") { d.textContent = t; if (window.YFix) window.YFix.decorate(d, t, summarizeAI, m && m.sum, g => { if (m) { m.sum = g; const h = hist(m.tab || tab); const x = h.find(y => y.id === m.id); if (x) { x.sum = g; saveHist(m.tab || tab, h) } } });
    if (m && m.att) d.append(el("div", { style: "font-size:13px;opacity:.9;margin-top:6px" }, (m.att.type === "pdf" ? "📄 " : "🖼️ ") + m.att.name)) }
  else d.innerHTML = md(t);
  CL.append(d); d.scrollIntoView({ block: "end", behavior: "smooth" }); return d;
}
async function summarizeAI(t) { if (offlineOnly() || lockedUntil()) return ""; try { const r = await fetch(BRAIN, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ v: 2, mode: "sum", signedIn: !guest(), auth: sessTok(), messages: [{ role: "user", content: t.slice(0, 4000) }] }) }); if (!r.ok) return ""; const x = await r.text(); const m = x.match(/^data: (.*)$/m); return JSON.parse(m[1]).choices[0].delta.content } catch (e) { return "" } }
let stEl = null;
function pill(t) { if (!CL) return; if (t == null) { stEl && stEl.remove(); stEl = null; return } if (!stEl) { stEl = el("div", { class: "st", role: "status" }); CL.append(stEl) } stEl.textContent = t; stEl.scrollIntoView({ block: "end" }) }
function setBusy(on, fn) { busy = on; stopFn = on ? fn : null; $("#stopBtn").classList.toggle("hidden", !on); $("#sendBtn").disabled = on; if (!on) pill(null) }
$("#stopBtn").onclick = () => { stopFn && stopFn(); setBusy(false) };

/* lock card with live countdown */
let lockT = null;
function lockCard(until) {
  $$(".lockc").forEach(x => x.remove()); clearInterval(lockT);
  const g = guest(); const c = el("div", { class: "lockc", role: "status" });
  c.innerHTML = `<img src="yathinai_logo.svg" alt="" style="width:52px;height:52px"><h3 style="margin:6px 0">${g ? "You've used your 15 free guest messages" : "You've reached your Free limit"}</h3><div class="cd"></div><p style="color:#6b6880;margin:0 0 12px">${g ? "Log in for more: signed-in Free accounts get much bigger limits and every mode." : "Take a break. Everything you made is saved on this device."}</p><div class="acts" style="justify-content:center"></div>`;
  const a = $(".acts", c);
  if (g) a.append(el("button", { class: "btn", onclick: () => openLogin() }, "Log in for more"));
  if (navigator.gpu) a.append(el("button", { class: "btn ghost", onclick: () => { SS.setItem("yai2-offnow", "1"); c.remove(); toast("Offline browser model on for this visit. It downloads once (about 1 GB).") } }, "Use offline browser model"));
  a.append(el("button", { class: "btn ghost", onclick: openPlans }, "See plans"));
  const tick = () => { const left = until - Date.now(); if (left <= 0) { clearInterval(lockT); lockedUntil(); c.remove(); return } $(".cd", c).textContent = `Your ${g ? "guest" : "free"} limit resets in ${fmtLeft(left)}` };
  tick(); lockT = setInterval(tick, 1000); CL && CL.append(c); c.scrollIntoView({ block: "end" });
}

/* ---------------- send ---------------- */
$("#q").addEventListener("input", e => { lastAct = Date.now(); e.target.style.height = "auto"; e.target.style.height = Math.min(160, e.target.scrollHeight) + "px" });
$("#q").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } });
$("#sendBtn").onclick = () => send();
async function send(forced) {
  let q = (forced != null ? forced : $("#q").value).trim(); if ((!q && !att) || busy) return;
  if (tab === "home") { go("chat") }
  if (guest() && !GUEST_OK.includes(tab)) { openLogin(); return }
  const until = lockedUntil(); if (until && !offlineOnly()) { lockCard(until); return }
  if (guest() && GL.n >= GUEST_MAX) { setHit(Date.now()); lockCard(lockedUntil()); return }
  if (!q && att) q = att.type === "pdf" ? "Summarize this PDF." : "What's in this image?";
  $("#q").value = ""; $("#q").style.height = "auto"; lastAct = Date.now();
  const A = att; att = null; drawAtt();
  const um = { id: Date.now(), role: "user", tab, show: q, content: q + (A && A.type === "pdf" ? `\n\n[Attached PDF: ${A.name}]\n${A.text.slice(0, 12000)}` : "") }; if (A) um.att = { type: A.type, name: A.name };
  const prev = hist(tab); const h = prev.concat(um); saveHist(tab, h);
  if (CL.querySelector(".hero")) CL.innerHTML = "";
  bubble("u", q, um);
  if (guest()) { GL.n++; if (GL.n >= GUEST_MAX) GL.hit = Date.now(); saveGuest(); if (GL.n >= GUEST_MAX) setHit(GL.hit) }
  if (isKid() && KIDBAD.test(q)) { const b = bubble("a", KID_REDIRECT); saveHist(tab, h.concat({ role: "assistant", content: KID_REDIRECT })); return }
  if (tab === "code") { const b = bubble("a", "…"); b.innerHTML = '<span style="color:#6b6880">Working on it…</span>'; return ide.agent(um.content, b, prev) }
  const ctrl = new AbortController(); setBusy(true, () => ctrl.abort()); pill(tab === "physics" || tab === "learn" ? "Thinking it through…" : "Thinking…");
  try {
    let mode = tab === "3d" ? "model" : tab, extra = {}, msgs = h.map(m => ({ role: m.role, content: m.content }));
    if (A && A.type === "img") { mode = "vision"; extra.image = A.data }
    else if (tab === "physics" && SIMRE.test(q)) mode = "sim";
    if (mode === "model") { extra.system = MODEL3D + ARCH; }
    if (tab === "games") extra.system = GAMESYS;
    const out = await ask(mode, msgs, ctrl.signal, extra);
    pill(null);
    const am = { role: "assistant", content: out, mode };
    if (mode === "model" || mode === "sim" || tab === "games") { const j = getJson(out); if (j) am.data = j; am.content = j ? (j.name || j.title || "Done") : out }
    const b = bubble("a", am.data ? "" : am.content, am);
    saveHist(tab, hist(tab).concat(am)); afterAnswer(b, am, true); addMem(tab, q, am.content);
    if (guest() && GL.n >= GUEST_MAX) toast("That was your last free guest message for now. Log in for more.");
  } catch (e) { pill(null); if (e instanceof LimitErr) lockCard(e.until); else bubble("a", errText(e)) }
  finally { setBusy(false) }
}
function afterAnswer(b, m, fresh) {
  if (m.mode === "model" || (tab === "3d" && m.data)) { const j = m.data; if (j && j.parts || j && j.components) { b.innerHTML = `<b>${esc(j.name || "Your model")}</b> · ready to spin and print.`; b.append(el("div", { class: "acts" }, el("button", { class: "btn", onclick: () => open3D(j, true) }, "🧊 Open model"))); if (fresh) open3D(j, true) } else b.innerHTML = md(m.content || "That model didn't come out right. Try asking a little differently.") }
  else if (m.mode === "sim" || (tab === "physics" && m.data)) { const j = m.data; if (j && Array.isArray(j.bodies)) { b.innerHTML = `<b>${esc(j.title || "Simulation")}</b><br>${esc(j.explain || "")}`; b.append(el("div", { class: "acts" }, el("button", { class: "btn", onclick: () => openSim(j, true) }, "▶ Run simulation"))); if (fresh) openSim(j, true) } else b.innerHTML = md(m.content || "That simulation didn't come out right. Try again.") }
  else if (tab === "games" && m.role === "assistant") { const j = m.data; if (j && (j.questions || j.pairs)) { b.innerHTML = `🎮 <b>${esc(j.title || "New game")}</b> is ready.`; b.append(el("div", { class: "acts" }, el("button", { class: "btn", onclick: () => playGame(j) }, "▶ Play"))); if (fresh) saveGame(j, true) } }
  else if (m.mode === "learn" || (tab === "learn" && m.role === "assistant")) b.append(el("div", { class: "acts" }, el("button", { class: "btn ghost", onclick: () => makeGame(m.content) }, "🎮 Make it a game")));
}

/* ---------------- 3D + physics ---------------- */
let lastSTL = null;
async function open3D(j, scroll) {
  if (Array.isArray(j.components)) { j.parts = j.components.concat(Array.isArray(j.parts) ? j.parts : []); delete j.components }
  const st = $("#stage"); if (!st) return; try { const r = await show3D(st, j); lastSTL = r.stl; $("#stageUI").innerHTML = ""; $("#stageUI").append(el("div", { class: "acts" }, el("span", { style: "align-self:center;color:#6b6880" }, `${esc(j.name || "Model")} · ${r.pieces} pieces`), el("button", { class: "btn", onclick: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(lastSTL); a.download = (j.name || "model").replace(/\W+/g, "-").toLowerCase() + ".stl"; a.click() } }, "⬇ Download STL"))); if (scroll && innerWidth < 860) st.scrollIntoView({ behavior: "smooth" }) } catch (e) { st.innerHTML = `<p style="padding:20px">3D view failed: ${esc(e.message)}</p>` }
}
async function openSim(j, scroll) {
  const st = $("#stage"); if (!st) return; const ui = $("#stageUI"); ui.innerHTML = "";
  const info = el("div", { style: "font-size:14px;color:#4c1d95;margin-top:8px;font-weight:600" });
  try { sim = await simulate(st, j, { tick: (t, bodies) => { info.textContent = `${j.title || "Simulation"} · t = ${t.toFixed(1)} s · gravity ${sim ? sim.gravity().toFixed(2) : ""} m/s²` } }); }
  catch (e) { st.innerHTML = `<p style="padding:20px">Simulation failed: ${esc(e.message)}</p>`; return }
  const g = +j.gravity || 0;
  ui.innerHTML = `<div class="sliders"><label>Gravity: <span id="gv">${g.toFixed(2)}</span> m/s²<input type="range" id="gs" min="0" max="25" step="0.01" value="${g}" ${sim.orbit ? "disabled" : ""}></label><label>Mass ×<span id="mv">1.0</span><input type="range" id="ms" min="0.1" max="5" step="0.1" value="1"></label></div>`;
  ui.append(el("div", { class: "acts" }, el("button", { class: "btn ghost", onclick: () => sim.reset() }, "↺ Reset"), el("button", { class: "btn ghost", onclick: e => { e.target.textContent = sim.pause() ? "▶ Play" : "⏸ Pause" } }, "⏸ Pause"),
    el("button", { class: "btn ghost", onclick: () => { $("#gs").value = 3.71; $("#gs").oninput() } }, "Mars"), el("button", { class: "btn ghost", onclick: () => { $("#gs").value = 1.62; $("#gs").oninput() } }, "Moon"), el("button", { class: "btn ghost", onclick: () => { $("#gs").value = 9.81; $("#gs").oninput() } }, "Earth")), info);
  $("#gs").oninput = () => { const v = +$("#gs").value; $("#gv").textContent = v.toFixed(2); sim.setGravity(v) };
  $("#ms").oninput = () => { const v = +$("#ms").value; $("#mv").textContent = v.toFixed(1); sim.setMass(v) };
  if (scroll && innerWidth < 860) st.scrollIntoView({ behavior: "smooth" });
}

/* ---------------- Learn -> Games ---------------- */
async function makeGame(notes) {
  if (busy) return; if (guest()) { openLogin(); return }
  const ctrl = new AbortController(); setBusy(true, () => ctrl.abort()); pill("Making your game…");
  try { const out = await ask("games", [{ role: "user", content: "Make a game from these notes:\n" + stripThink(notes).slice(0, 8000) }], ctrl.signal, { system: GAMESYS }); const j = getJson(out); if (!j || !(j.questions || j.pairs)) throw new Error("The game didn't come out right. Try again."); saveGame(j); addMem("games", "made a game", j.title || ""); go("games"); playGame(j) }
  catch (e) { if (e instanceof LimitErr) lockCard(e.until); else toast(errText(e)) } finally { setBusy(false) }
}
function saveGame(j, play) { const g = getJ(K("games"), []); g.unshift({ id: Date.now(), ...j }); setJ(K("games"), g.slice(0, 30)); if (tab === "games") { drawGames(); if (play) playGame(j) } }
function drawGames() { const l = $("#gList"); if (!l) return; const g = getJ(K("games"), []); l.innerHTML = "<h4 style='margin:0 0 6px'>Your games</h4>"; if (!g.length) l.append(el("p", { style: "color:#6b6880;margin:0" }, "No games yet. Ask for one, or tap “Make it a game” under a Learn answer.")); const w = el("div", { class: "ex", style: "justify-content:flex-start;margin:0" }); g.forEach(x => w.append(el("button", { class: "chip", onclick: () => playGame(x) }, (x.kind === "match" ? "🧩 " : "❓ ") + (x.title || "Game")))); l.append(w); if (!$("#gPlay").innerHTML && g[0]) playGame(g[0]) }
function playGame(j) {
  const P = $("#gPlay"); if (!P) { go("games"); setTimeout(() => playGame(j), 50); return }
  const qs = (j.questions || []).filter(q => q && Array.isArray(q.choices) && q.choices.length >= 2);
  if ((j.kind === "match" || !qs.length) && Array.isArray(j.pairs) && j.pairs.length) return playMatch(P, j);
  let i = 0, score = 0;
  const show = () => { if (i >= qs.length) { P.innerHTML = `<h3>🎉 ${esc(j.title || "Quiz")} done!</h3><p style="font-size:20px">You scored <b>${score} / ${qs.length}</b></p>`; P.append(el("button", { class: "btn", onclick: () => { i = 0; score = 0; show() } }, "Play again")); return }
    const q = qs[i]; P.innerHTML = `<div style="color:#6b6880;font-size:13px">${esc(j.title || "Quiz")} · Question ${i + 1} of ${qs.length} · Score ${score}</div><h3 style="margin:6px 0">${esc(q.q)}</h3>`;
    const ans = Math.max(0, Math.min(q.choices.length - 1, +q.answer || 0));
    q.choices.forEach((c, k) => P.append(el("button", { class: "opt", onclick: e => { if (P.dataset.done) return; P.dataset.done = 1; const ok = k === ans; if (ok) score++; e.target.classList.add(ok ? "right" : "wrong"); $$(".opt", P)[ans].classList.add("right"); P.append(el("p", {}, (ok ? "✅ Correct! " : "❌ Not quite. ") + (q.why || ""))); P.append(el("button", { class: "btn", onclick: () => { delete P.dataset.done; i++; show() } }, i + 1 < qs.length ? "Next →" : "See score")) } }, c))) };
  delete P.dataset.done; show();
}
function playMatch(P, j) {
  const pairs = j.pairs.filter(p => Array.isArray(p) && p.length >= 2).slice(0, 8); let tries = 0, done = 0, pick = null;
  const L1 = pairs.map((p, i) => ({ t: p[0], i })).sort(() => Math.random() - .5), R1 = pairs.map((p, i) => ({ t: p[1], i })).sort(() => Math.random() - .5);
  P.innerHTML = `<div style="color:#6b6880;font-size:13px">${esc(j.title || "Match game")} · Tap a word, then its match</div><div class="match" id="mg"></div><p id="ms2"></p>`;
  const g = $("#mg", P); const rows = Math.max(L1.length, R1.length);
  for (let r = 0; r < rows; r++) [L1[r], R1[r]].forEach((x, side) => { if (!x) return g.append(el("span")); const b = el("button", { onclick: () => {
      if (b.classList.contains("done")) return;
      if (!pick || pick.side === side) { $$(".sel", g).forEach(y => y.classList.remove("sel")); pick = { side, i: x.i, b }; b.classList.add("sel"); return }
      tries++; if (pick.i === x.i) { pick.b.classList.remove("sel"); pick.b.classList.add("done"); b.classList.add("done"); done++ } else { pick.b.classList.remove("sel") } pick = null;
      $("#ms2", P).textContent = done === pairs.length ? `🎉 All matched in ${tries} tries!` : `${done} of ${pairs.length} matched` } }, x.t); g.append(b) });
}

/* ---------------- uploads: images -> vision, PDFs -> pdf.js text ---------------- */
$("#upBtn").onclick = () => { if (guest()) { openLogin("Log in to upload images and PDFs."); return } $("#upFile").click() };
$("#upFile").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
    att = { type: "pdf", name: f.name, text: "", loading: true }; drawAtt();
    try { const PJ = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/" + (Promise.withResolvers ? "build" : "legacy/build"); /* legacy build for older Safari / iPad */ const pdfjs = await import(PJ + "/pdf.min.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = PJ + "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise; let t = ""; const n = Math.min(doc.numPages, 40);
      for (let i = 1; i <= n; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); t += c.items.map(x => x.str).join(" ") + "\n\n"; if (t.length > 40000) break }
      att = { type: "pdf", name: f.name, text: t.trim(), pages: doc.numPages }; if (!att.text) { att = null; toast("That PDF has no readable text (it may be scanned).") } }
    catch (x) { att = null; toast("Couldn't read that PDF: " + x.message) }
    drawAtt(); return }
  if (!/^image\//.test(f.type)) { toast("Upload an image or a PDF."); return }
  const img = new Image(); img.onload = () => { const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); att = { type: "img", name: f.name, data: c.toDataURL("image/jpeg", .85) }; URL.revokeObjectURL(img.src); drawAtt() }; img.src = URL.createObjectURL(f);
};
function drawAtt() { const r = $("#attachRow"); r.innerHTML = ""; if (!att) return; const a = el("div", { class: "att" });
  if (att.type === "img") a.append(el("img", { src: att.data, alt: "" }), el("span", {}, "Image ready: ask about it"));
  else if (att.loading) a.append(el("span", {}, "📄 Reading " + att.name + "…"));
  else a.append(el("span", {}, `📄 ${att.name} · ${att.pages} page${att.pages > 1 ? "s" : ""}`), el("button", { class: "btn ghost", onclick: () => { if (!["chat", "learn"].includes(tab)) go("learn"); send("Summarize this PDF in clear sections with the key points.") } }, "Summarize"), el("button", { class: "btn ghost", onclick: () => { const t = att.text; att = null; drawAtt(); makeGame(t) } }, "Quiz me"));
  a.append(el("button", { class: "btn ghost", "aria-label": "Remove attachment", onclick: () => { att = null; drawAtt() } }, "✕")); r.append(a) }

/* ---------------- Home panels ---------------- */
const KINDS = { weather: "🌤 Weather", clock: "🕒 Clock", fact: "💡 Fun fact", todo: "✅ To-do", count: "⏳ Countdown" };
const FACTS = ["Octopuses have three hearts.", "Honey never spoils.", "A day on Venus is longer than its year.", "Bananas are berries, but strawberries aren't.", "Sharks are older than trees.", "Your brain uses about 20% of your energy.", "A group of flamingos is called a flamboyance.", "Light from the Sun takes about 8 minutes to reach Earth."];
const WMO = c => c === 0 ? ["☀️", "Clear"] : c <= 3 ? ["⛅", "Partly cloudy"] : c <= 48 ? ["🌫", "Foggy"] : c <= 67 ? ["🌧", "Rain"] : c <= 77 ? ["❄️", "Snow"] : c <= 82 ? ["🌦", "Showers"] : ["⛈", "Storms"];
let clockT = null;
function renderHome(M) {
  const PN = getJ(K("panels"), [{ t: "weather" }, { t: "clock" }, { t: "fact" }]); const save = () => setJ(K("panels"), PN);
  const nm = L.getItem("yai-name"); M.innerHTML = `<h2 style="margin:20px 4px 12px">${guest() ? "Home" : "Hi, " + esc(nm || "there")} 👋</h2><div class="grid" id="pg"></div>${PLANS()}<footer>Yathin AI · Part of Yathin Looops · Created by Yathin Pedamallu</footer>`;
  const g = $("#pg"); clearInterval(clockT);
  PN.forEach((p, i) => { const d = el("div", { class: "card pnl" }); d.innerHTML = `<h4><span>${esc(p.t === "ai" ? "✨ " + p.name : KINDS[p.t])}</span></h4><div class="c"></div>`; $("h4", d).append(el("button", { class: "x", "aria-label": "Remove panel", onclick: () => { PN.splice(i, 1); save(); renderHome(M) } }, "×")); fill(p, $(".c", d), save, M); g.append(d) });
  const a = el("div", { class: "card pnl addp" }, el("h4", {}, "＋ New panel")); Object.keys(KINDS).forEach(k => a.append(el("button", { onclick: () => { PN.push({ t: k }); save(); renderHome(M) } }, KINDS[k])));
  if (guest()) a.append(el("button", { class: "lockline", onclick: () => openLogin("Log in to create AI panels.") }, "🔒 Log in to create AI panels"));
  else { const gi = el("input", { placeholder: "Or describe one: a dice roller…", "aria-label": "Describe an AI panel" }); const gb = el("button", { class: "btn", style: "margin-top:8px;width:100%", onclick: async () => { const w = gi.value.trim(); if (!w || busy) return; gb.textContent = "Making your panel…"; busy = true; try { const out = await ask("panel", [{ role: "user", content: "Make a widget: " + w }]); const m = stripThink(out).match(/```html\s*([\s\S]*?)```/i) || out.match(/(<!doctype[\s\S]*<\/html>)/i); if (!m) throw new Error("no HTML came back"); PN.push({ t: "ai", name: w.slice(0, 30), html: m[1] }); save() } catch (e) { if (e instanceof LimitErr) toast("Limit reached. Try again later."); else toast("Couldn't make that panel: " + errText(e)) } busy = false; renderHome(M) } }, "✨ Generate with AI"); a.append(gi, gb) }
  g.append(a);
}
function fill(p, c, save, M) {
  if (p.t === "clock") { const f = () => { const d = new Date(); c.innerHTML = `<div class="big">${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div><div>${d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>` }; f(); clockT = setInterval(f, 10000) }
  else if (p.t === "fact") c.innerHTML = `<div style="font-size:17px">${FACTS[Math.floor(Date.now() / 864e5) % FACTS.length]}</div>`;
  else if (p.t === "todo") { p.items = p.items || []; c.innerHTML = ""; p.items.forEach((t, j) => { const lb = el("label", { style: "display:flex;align-items:center;gap:8px;min-height:44px" }); const cb = el("input", { type: "checkbox" }); cb.checked = !!t.d; cb.onchange = () => { t.d = cb.checked; save() }; lb.append(cb, t.x); c.append(lb) }); const i = el("input", { placeholder: "Add a task, press Enter", "aria-label": "Add a task" }); i.onkeydown = e => { if (e.key === "Enter" && i.value.trim()) { p.items.push({ x: i.value.trim() }); save(); fill(p, c, save, M) } }; c.append(i) }
  else if (p.t === "count") { if (!p.date) { c.innerHTML = "<div>Count down to:</div>"; const i = el("input", { type: "date", "aria-label": "Countdown date" }); i.onchange = () => { p.date = i.value; save(); fill(p, c, save, M) }; c.append(i); return } const days = Math.ceil((new Date(p.date + "T00:00") - new Date()) / 864e5); c.innerHTML = `<div class="big">${days}</div><div>days until ${new Date(p.date + "T00:00").toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>` }
  else if (p.t === "weather") weather(p, c, save);
  else if (p.t === "ai") { const f = el("iframe", { sandbox: "allow-scripts", title: p.name }); f.srcdoc = p.html; c.append(f) }
}
async function weather(p, c, save) {
  if (!p.lat) { c.innerHTML = ""; const b = el("button", { class: "btn ghost", onclick: () => navigator.geolocation.getCurrentPosition(g => { p.lat = g.coords.latitude; p.lon = g.coords.longitude; p.place = "Your location"; save(); weather(p, c, save) }, () => { b.textContent = "Location blocked. Type a city." }) }, "📍 Use my location"); const i = el("input", { placeholder: "Or type a city, press Enter", "aria-label": "City" }); i.onkeydown = async e => { if (e.key !== "Enter") return; try { const r = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(i.value))).json(); const x = r.results && r.results[0]; if (!x) { i.value = ""; i.placeholder = "City not found"; return } p.lat = x.latitude; p.lon = x.longitude; p.place = x.name; save(); weather(p, c, save) } catch (x) { i.placeholder = "Couldn't search" } }; c.append(b, i); return }
  c.textContent = "Loading…";
  try { const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`)).json(); const [ic, tx] = WMO(r.current.weather_code);
    c.innerHTML = `<div class="big">${ic} ${Math.round(r.current.temperature_2m)}°</div><div>${tx} · High ${Math.round(r.daily.temperature_2m_max[0])}° Low ${Math.round(r.daily.temperature_2m_min[0])}°</div><div style="color:#6b6880;font-size:13px">${esc(p.place)}</div>`; c.append(el("button", { class: "btn ghost", onclick: () => { delete p.lat; save(); weather(p, c, save) } }, "Change place")) }
  catch (e) { c.textContent = "Couldn't load weather." }
}

/* ---------------- code IDE context ---------------- */
const ideCtx = {
  loadProject: () => getJ(K("proj"), { files: {}, store: {} }), saveProject: P => setJ(K("proj"), P),
  clearHistory: () => { saveHist("code", []); if (CL) CL.innerHTML = "" },
  ask: (mode, msgs, signal) => ask(mode, msgs, signal).catch(e => { if (e instanceof LimitErr) { lockCard(e.until); throw new Error("Limit reached.") } throw e }),
  bubble: t => { bubble("u", t); const b = bubble("a", ""); b.innerHTML = '<span style="color:#6b6880">Working on it…</span>'; return b },
  answer: (b, text) => { b.innerHTML = md(text); saveHist("code", hist("code").concat({ role: "assistant", content: text })); addMem("code", hist("code").filter(m => m.role === "user").slice(-1)[0]?.show || "code", text) },
  note: (b, text, diffH, title) => { if (text) b.append(el("div", { style: "font-size:13px;color:#4c1d95;margin-top:8px;font-weight:600" }, text)); if (diffH) { const d = el("details", { style: "margin-top:8px" }, el("summary", { style: "cursor:pointer;min-height:32px;font-size:14px" }, title || "Show changes")); const x = el("div", { class: "diff", html: diffH }); d.append(x); b.append(d) } },
  busy: (on, fn) => setBusy(on, fn), errText
};

/* ---------------- modals: sign-in, age, PIN, settings, plans ---------------- */
function modal(html) { const root = $("#modalRoot"); root.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="box">${html}</div></div>`; const m = $(".modal", root); m.onclick = e => { if (e.target === m) closeModal() }; return $(".box", root) }
function closeModal() { $("#modalRoot").innerHTML = "" }
const GCID = "148201480683-9894qd6i7mjoqmrujbvq50k0pekqtafs.apps.googleusercontent.com";
const GSI_ORIGINS = ["https://praveenp-works.github.io", "https://yathinlooops.pages.dev"]; // add https://yathinlooops.pages.dev here after adding it to the OAuth client's Authorized JavaScript origins
let gsiP = null; function gsi() { if (!GSI_ORIGINS.includes(location.origin)) return Promise.reject(new Error("origin"));  if (!gsiP) gsiP = loadScript("https://accounts.google.com/gsi/client").then(() => { window.google.accounts.id.initialize({ client_id: GCID, callback: gDone, ux_mode: "popup" }) }).catch(e => { gsiP = null; throw e }); return gsiP }
function gDone(r) { try { const b = r.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); const j = JSON.parse(decodeURIComponent(escape(atob(b)))); if (!j.email) throw 0; const e = j.email.toLowerCase(); window.YFix.markGoogle(e); linkGoogle(r.credential, e); L.setItem("yai-name", j.given_name || j.name || e.split("@")[0]); afterLogin(e) } catch (x) { const er = $("#lErr"); if (er) er.textContent = "Google sign-in didn't work. Use email instead." } }
function openLogin(why) {
  if (user()) return;
  const b = modal(`<h3><img src="yathinai_logo.svg" alt="">Yathin AI</h3><p class="note">${esc(why || "Log in to unlock Code, 3D, Learn, Physics, Games and more, plus custom Home panels.")}</p>
   <div id="gsiBox" style="min-height:44px;margin-top:10px;display:flex;justify-content:center"></div>
   <div id="orLine" style="text-align:center;color:#6b6880;font-size:13px;margin:8px 0">or use email (saved on this device only)</div>
   <label for="lEmail">Email</label><input id="lEmail" type="email" autocomplete="email" placeholder="you@example.com">
   <label for="lPass">Password</label><input id="lPass" type="password" autocomplete="current-password">
   <div id="lP2w" class="hidden"><label for="lPass2">Confirm password</label><input id="lPass2" type="password" autocomplete="new-password"></div>
   <div class="err" id="lErr" role="alert"></div>
   <div class="row2"><button class="btn ghost" id="lCancel">Continue as guest</button><button class="btn" id="lGo">Log in</button></div>`);
  gsi().then(() => { const box = $("#gsiBox"); if (box) window.google.accounts.id.renderButton(box, { type: "standard", size: "large", shape: "pill", text: "continue_with", width: 280 }) }).catch(() => { const box = $("#gsiBox"); if (box) box.remove(); const o = $("#orLine"); if (o) o.textContent = "Sign in with email (saved on this device only)" });
  let lMode = ""; $("#lEmail").oninput = () => { lMode = ""; $("#lP2w").classList.add("hidden"); $("#lGo").textContent = "Log in" };
  $("#lCancel").onclick = closeModal;
  const goF = async () => { const e = $("#lEmail").value.trim().toLowerCase(), pw = $("#lPass").value, er = $("#lErr"), F = window.YFix;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { er.textContent = "Enter a real email."; return }
    const st = F.state(e);
    if (st === "google") { er.textContent = "This account signs in with Google. Use the Google button above."; return }
    if (st === "pbkdf2" || st === "legacy") { if (!pw) { er.textContent = "Enter your password."; return } er.textContent = "Checking…"; if (!(await F.check(e, pw))) { er.textContent = "Wrong password"; return } }
    else { const want = st === "new" ? "create" : "set";
      if (lMode !== want) { lMode = want; $("#lP2w").classList.remove("hidden"); $("#lGo").textContent = want === "create" ? "Create account" : "Set password"; er.textContent = want === "create" ? "New here? Choose a password (8+ characters) and type it again to create your account on this device." : "This account doesn't have a password yet. Set one now (8+ characters)."; $("#lPass2").focus(); return }
      if (pw.length < 8) { er.textContent = "Password needs 8 or more characters."; return }
      if (pw !== $("#lPass2").value) { er.textContent = "The two passwords don't match."; return }
      await F.setPw(e, pw) }
    if (!L.getItem("yai-name") || L.getItem("yai-user") !== e) { const n = e.split("@")[0].replace(/[^a-z]/gi, " ").trim(); L.setItem("yai-name", n.charAt(0).toUpperCase() + n.slice(1)) }
    afterLogin(e) };
  $("#lGo").onclick = goF; [$("#lPass"), $("#lPass2")].forEach(i => i.onkeydown = e => { if (e.key === "Enter") goF() });
  setTimeout(() => $("#lEmail") && $("#lEmail").focus(), 50);
}
function afterLogin(e) { L.setItem("yai-user", e); const m = getJ("yai-agefor", {}); if (e in m) { closeModal(); refresh() } else askAge() }
function askAge() {
  modal(`<h3><img src="yathinai_logo.svg" alt="">How old are you?</h3><p class="note">Enter your birthday (or just your age). Under 13 gets Kids Mode for Learning, made safe and simple.</p>
   <label for="ageIn" id="ageLbl">Birthday</label><input id="ageIn" type="date" min="1906-01-01">
   <button class="btn ghost" id="ageNum" style="margin-top:8px">Type my age instead</button>
   <div class="err" id="ageErr" role="alert"></div><div class="row2"><button class="btn" id="ageGo">Continue</button></div>`);
  $("#ageNum").onclick = () => { const i = $("#ageIn"), d = i.type === "date"; i.type = d ? "text" : "date"; i.value = ""; i.setAttribute("inputmode", d ? "numeric" : "text"); i.placeholder = d ? "Your age, like 12" : ""; $("#ageLbl").textContent = d ? "Age" : "Birthday"; $("#ageNum").textContent = d ? "Pick my birthday instead" : "Type my age instead"; i.focus() };
  $("#ageGo").onclick = () => { const r = window.YFix.age($("#ageIn").value); if (r.err) { $("#ageErr").textContent = r.err; return }
    const m = getJ("yai-agefor", {}); m[user()] = r.age < 13 ? 1 : 0; setJ("yai-agefor", m);
    if (r.age < 13) setPinModal(true); else { closeModal(); refresh() } };
  $("#ageIn").onkeydown = e => { if (e.key === "Enter") $("#ageGo").click() };
}
const pinMap = () => getJ("yai-pinfor", {}), pinOf = () => pinMap()[user()] || "";
function setPinModal(first) {
  modal(`<h3><img src="yathinai_logo.svg" alt="">${first ? "Kids Mode for Learning is on" : "Parent PIN"}</h3><p class="note">${first ? "Parent or guardian: set a 4-digit PIN. It's needed to turn Kids Mode off or change kid settings. Kids won't be asked for it while they learn." : "Choose a new 4-digit parent PIN."}</p>
   <label for="pin1">New PIN</label><input id="pin1" type="password" inputmode="numeric" maxlength="4" autocomplete="off"><label for="pin2">Type it again</label><input id="pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="off">
   <div class="err" id="pinErr" role="alert"></div><div class="row2"><button class="btn" id="pinGo">Save PIN</button></div>`);
  $("#pinGo").onclick = async () => { const a = $("#pin1").value.trim(), b = $("#pin2").value.trim(); if (!/^\d{4}$/.test(a)) { $("#pinErr").textContent = "Use exactly 4 digits."; return } if (a !== b) { $("#pinErr").textContent = "The PINs don't match."; return }
    const m = pinMap(); m[user()] = await sha("pin|" + a); setJ("yai-pinfor", m); SS.setItem("yai-pinok", Date.now() + 30 * 60e3); closeModal(); refresh(); toast("Parent PIN saved.") };
}
/* the PIN is asked only to set it, turn Kids Mode off, change kid settings or open Advanced settings in Kids Mode; an unlock lasts 30 minutes */
function parentGate(then) {
  if (+SS.getItem("yai-pinok") > Date.now()) return then();
  if (!pinOf()) { toast("A parent needs to set a PIN first."); setPinModal(false); return }
  modal(`<h3><img src="yathinai_logo.svg" alt="">Parent PIN</h3><p class="note">A parent or guardian needs to enter the PIN.</p><label for="pinIn">PIN</label><input id="pinIn" type="password" inputmode="numeric" maxlength="4" autocomplete="off"><div class="err" id="pinErr" role="alert"></div><div class="row2"><button class="btn ghost" id="pinNo">Cancel</button><button class="btn" id="pinOk">Unlock</button></div>`);
  $("#pinNo").onclick = closeModal; const ok = async () => { if (await sha("pin|" + $("#pinIn").value.trim()) !== pinOf()) { $("#pinErr").textContent = "Wrong PIN."; return } SS.setItem("yai-pinok", Date.now() + 30 * 60e3); closeModal(); then() };
  $("#pinOk").onclick = ok; $("#pinIn").onkeydown = e => { if (e.key === "Enter") ok() }; setTimeout(() => $("#pinIn").focus(), 50);
}
function setKid(on) { const m = getJ("yai-agefor", {}); m[user()] = on ? 1 : 0; setJ("yai-agefor", m); if (isKid() && KID_NO.includes(tab)) tab = "learn"; refresh() }
function openSettings() {
  const go2 = () => { const b = modal(`<h3><img src="yathinai_logo.svg" alt="">Advanced / Offline Settings</h3>
   <button class="row" id="sOn" style="width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:#f6f4ff;border-radius:14px;padding:0 14px;margin-top:10px">Smart online AI (recommended)<span class="sw ${L.getItem("yai2-online") === "0" ? "" : "on"}"></span></button>
   <h4 style="margin:16px 0 4px">Offline browser model</h4><p class="note">Runs a small AI (Qwen2.5 1.5B) inside this browser with WebGPU. One-time download of about 1 GB; after that it works without internet. It's also the backup when the online AI is busy.</p>
   <div class="row2"><button class="btn ghost" id="sDl">${L.getItem("yai2-localready") === "1" ? "✓ Downloaded · load it" : "Download offline model"}</button></div><div class="note" id="sDlSt" role="status"></div>
   <button class="row" id="sOff" style="width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:#f6f4ff;border-radius:14px;padding:0 14px;margin-top:10px">Use the offline model only<span class="sw ${L.getItem("yai2-offline") === "1" ? "on" : ""}"></span></button>
   <h4 style="margin:16px 0 4px">Ollama (your own computer)</h4><p class="note">Install Ollama, run <code>ollama pull llama3.2</code>, then start it with <code>OLLAMA_ORIGINS=* ollama serve</code> so this page can reach <code>localhost:11434</code>.</p>
   <button class="row" id="sOl" style="width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:#f6f4ff;border-radius:14px;padding:0 14px">Use Ollama<span class="sw ${L.getItem("yai2-ollama") === "1" ? "on" : ""}"></span></button>
   <label for="sOlm">Ollama model</label><input id="sOlm" type="text" value="${esc(L.getItem("yai2-olm") || "llama3.2")}">
   <div class="row2"><button class="btn" id="sDone">Done</button></div>`);
    const tg = (id, key, invert) => { $(id).onclick = () => { const cur = L.getItem(key); const on = invert ? cur === "0" : cur !== "1"; L.setItem(key, invert ? (on ? "1" : "0") : (on ? "1" : "0")); $(id + " .sw").classList.toggle("on", on) } };
    tg("#sOn", "yai2-online", true); tg("#sOff", "yai2-offline"); tg("#sOl", "yai2-ollama");
    $("#sOlm").oninput = e => L.setItem("yai2-olm", e.target.value.trim());
    $("#sDl").onclick = async () => { try { await ensureLocal(t => { $("#sDlSt").textContent = t }); $("#sDlSt").textContent = "Offline model ready ✓" } catch (e) { $("#sDlSt").textContent = e.message } };
    $("#sDone").onclick = closeModal };
  if (isKid()) parentGate(go2); else go2();
}
function openPlans() { modal(PLANS() + '<div class="row2"><button class="btn" id="plOk">Close</button></div>').style.width = "min(980px,100%)"; $("#plOk").onclick = closeModal }
/* account menu */
$("#meBtn").onclick = e => { e.stopPropagation(); const a = $("#acct"); if (!a.classList.contains("hidden")) { a.classList.add("hidden"); return } drawAcct(); a.classList.remove("hidden") };
document.addEventListener("click", e => { const a = $("#acct"); if (!a.classList.contains("hidden") && !a.contains(e.target)) a.classList.add("hidden") });
function drawAcct() {
  const a = $("#acct"); a.innerHTML = ""; const row = (label, fn, sw) => { const b = el("button", { class: "row", onclick: () => { fn(); if (sw == null) a.classList.add("hidden") } }, label); if (sw != null) b.append(el("span", { class: "sw" + (sw ? " on" : "") })); a.append(b) };
  if (guest()) { a.append(el("h4", {}, "Guest"), el("div", { class: "sub" }, `${Math.max(0, GUEST_MAX - GL.n)} of ${GUEST_MAX} free guest messages left`)); row("Log in / Sign up", () => openLogin()) }
  else { a.append(el("h4", {}, L.getItem("yai-name") || "You"), el("div", { class: "sub" }, user() + " · Free plan"));
    const u = getJ(K("use"), { chat: 0, code: 0 }); a.append(el("div", { class: "sub" }, `Today: Chat ${Math.round(u.chat / 60)} min of 20 h · Code ${Math.round(u.code / 60)} min of 14 h`));
    row("🧒 Kids Mode for Learning", () => { if (isKid()) parentGate(() => setKid(false)); else if (pinOf()) parentGate(() => setKid(true)); else { setKid(true); setPinModal(true) } a.classList.add("hidden") }, isKid());
    row(pinOf() ? "🔑 Change parent PIN" : "🔑 Set parent PIN", () => { if (pinOf()) parentGate(() => setPinModal(false)); else setPinModal(false) }) }
  row("⚙️ Advanced / Offline Settings", openSettings);
  row("👑 Choose Your Plan", openPlans);
  if (!guest()) row("Sign out", () => { L.removeItem("yai-user"); SS.removeItem("yai-pinok"); refresh() });
}
function refresh() { drawTabs(); if ((guest() && !GUEST_OK.includes(tab)) || (isKid() && KID_NO.includes(tab))) tab = isKid() ? "learn" : "chat"; drawTabs(); render() }

/* ---------------- start ---------------- */
await loadGuest();
if (!TABS.some(t => t[0] === tab)) tab = "chat";
refresh();
window.YAI2 = { go, send, openLogin, lockedUntil, GL: () => GL, ask };
