/* Yathin AI next: Code tab coding agent (plan -> write -> run -> capture errors -> auto-fix up to 3 rounds) */
import { $, esc, el, stripThink, loadScript } from "./util.js";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
const JSZIP = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const MAX_FIX = 3;

/* ---------- parse model output into files and search/replace edits ---------- */
const LANG_FILE = { html: "index.html", htm: "index.html", css: "style.css", js: "app.js", javascript: "app.js", py: "main.py", python: "main.py", json: "data.json" };
export function parseOutput(text) {
  text = stripThink(text);
  const files = {}, edits = [];
  const re = /(FILE|EDIT)\s*:\s*`?([\w./-]+\.[\w]+)`?\s*\**\s*\n+\s*```[^\n]*\n([\s\S]*?)\n?```/g; let m, found = false;
  while ((m = re.exec(text))) { found = true;
    if (m[1] === "FILE") files[m[2]] = m[3].replace(/\s+$/, "") + "\n";
    else { const blocks = []; const br = /<{5,9}\s*SEARCH\s*\n([\s\S]*?)\n?={5,9}\s*\n([\s\S]*?)\n?>{5,9}\s*REPLACE/g; let b; while ((b = br.exec(m[3]))) blocks.push({ search: b[1], replace: b[2] });
      if (blocks.length) edits.push({ name: m[2], blocks }); else files[m[2]] = m[3].replace(/\s+$/, "") + "\n" } }
  if (!found) { // fallback: fenced blocks named by a header comment or by language
    const fb = /```([\w+-]*)[^\n]*\n([\s\S]*?)```/g; let f;
    while ((f = fb.exec(text))) { const body = f[2]; const first = body.split("\n")[0];
      const hm = first.match(/(?:<!--|\/\*|\/\/|#)\s*([\w./-]+\.(html|css|js|py|json))\s*(?:-->|\*\/)?/i);
      const name = hm ? hm[1] : LANG_FILE[(f[1] || "").toLowerCase()]; if (name && !files[name]) files[name] = body.replace(/\s+$/, "") + "\n" } }
  const note = text.replace(/(FILE|EDIT)\s*:[^\n]*\n+\s*```[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "").trim();
  return { files, edits, note };
}
function applyEdit(src, { search, replace }) {
  if (src.includes(search)) return src.replace(search, replace);
  const norm = s => s.split("\n").map(x => x.trim()).join("\n").trim();
  const lines = src.split("\n"), want = norm(search).split("\n"), n = want.length;
  for (let i = 0; i + n <= lines.length; i++) if (lines.slice(i, i + n).map(x => x.trim()).join("\n") === want.join("\n")) { lines.splice(i, n, ...replace.split("\n")); return lines.join("\n") }
  return null;
}
export function applyChanges(files, parsed) {
  const out = { ...files }, changed = [], failed = [];
  for (const [k, v] of Object.entries(parsed.files)) { if (out[k] !== v) changed.push(k); out[k] = v }
  for (const e of parsed.edits) { let src = out[e.name]; if (src == null) { failed.push(e.name + " (file not found)"); continue }
    for (const b of e.blocks) { const r = applyEdit(src, b); if (r == null) failed.push(e.name + ": search text not found"); else src = r }
    if (src !== out[e.name]) { out[e.name] = src; if (!changed.includes(e.name)) changed.push(e.name) } }
  return { files: out, changed, failed };
}
/* tiny line diff (LCS) */
export function diff(a, b) {
  a = (a || "").split("\n"); b = (b || "").split("\n");
  if (a.length * b.length > 250000) return [{ t: "add", s: `(${b.length} lines, too big to diff)` }];
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push({ t: "same", s: a[i] }); i++; j++ } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: "del", s: a[i++] }); else out.push({ t: "add", s: b[j++] }) }
  while (i < n) out.push({ t: "del", s: a[i++] }); while (j < m) out.push({ t: "add", s: b[j++] });
  return out;
}
function diffHtml(oldF, newF, changed) {
  return changed.map(name => { const d = diff(oldF[name] || "", newF[name] || ""); const adds = d.filter(x => x.t === "add").length, dels = d.filter(x => x.t === "del").length;
    const body = d.filter(x => x.t !== "same").slice(0, 120).map(x => `<span class="${x.t}">${x.t === "add" ? "+" : "−"} ${esc(x.s)}</span>`).join("");
    return `<b>${esc(name)}</b> <small>+${adds} −${dels}</small>\n${body}` }).join("\n");
}
export const isPython = f => !!f["main.py"] && !f["index.html"];

/* ---------- sandbox runners ---------- */
function buildDoc(files, id, store) {
  let html = files["index.html"] || `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>App</title><link rel="stylesheet" href="style.css"></head><body><div id="app"></div><script src="app.js"></script></body></html>`;
  const safe = s => String(s || "").replace(/<\/script/gi, "<\\/script");
  const cap = `<script>(function(){var ID=${JSON.stringify(id)};function P(t,a){try{parent.postMessage({__yai:ID,t:t,a:a},"*")}catch(e){}}
function S(x){try{return typeof x==="string"?x:(x instanceof Error?x.name+": "+x.message:JSON.stringify(x))}catch(e){return String(x)}}
["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){var a=[].slice.call(arguments).map(S).join(" ");P(k,a);try{o.apply(console,arguments)}catch(e){}}});
window.addEventListener("error",function(e){P("error",(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});
window.addEventListener("unhandledrejection",function(e){P("error","Unhandled promise rejection: "+S(e.reason))});
var D=${JSON.stringify(store || {})},M={getItem:function(k){return Object.prototype.hasOwnProperty.call(D,k)?D[k]:null},setItem:function(k,v){D[k]=String(v);P("store",D)},removeItem:function(k){delete D[k];P("store",D)},clear:function(){D={};P("store",D)},key:function(i){return Object.keys(D)[i]||null},get length(){return Object.keys(D).length}};
try{Object.defineProperty(window,"localStorage",{value:M,configurable:true})}catch(e){}try{Object.defineProperty(window,"sessionStorage",{value:{getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){}},configurable:true})}catch(e){}
var T=[];window.test=function(n,f){T.push([n,f])};window.assert=function(c,m){if(!c)throw new Error(m||"assertion failed")};
window.__runTests=async function(){for(var i=0;i<T.length;i++){try{await T[i][1]();P("pass",T[i][0])}catch(e){P("fail",T[i][0]+": "+S(e))}}P("done",T.length)};
})();<\/script>`;
  const css = files["style.css"];
  if (css != null) { if (/<link[^>]+href=["']\.?\/?style\.css["'][^>]*>/i.test(html)) html = html.replace(/<link[^>]+href=["']\.?\/?style\.css["'][^>]*>/i, () => `<style>${css}</style>`); else html = html.replace(/<\/head>/i, () => `<style>${css}</style></head>`) }
  else html = html.replace(/<link[^>]+href=["']\.?\/?style\.css["'][^>]*>/i, "");
  const js = files["app.js"];
  if (js != null) { if (/<script[^>]+src=["']\.?\/?app\.js["'][^>]*>\s*<\/script>/i.test(html)) html = html.replace(/<script[^>]+src=["']\.?\/?app\.js["'][^>]*>\s*<\/script>/i, () => `<script>${safe(js)}<\/script>`); else html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => `<script>${safe(js)}<\/script></body>`) : html + `<script>${safe(js)}<\/script>` }
  else html = html.replace(/<script[^>]+src=["']\.?\/?app\.js["'][^>]*>\s*<\/script>/i, "");
  const tests = (files["tests.js"] ? `<script>${safe(files["tests.js"])}<\/script>` : "") + `<script>window.addEventListener("load",function(){setTimeout(function(){window.__runTests()},400)})<\/script>`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => tests + "</body>") : html + tests;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + cap) : cap + html;
  return html;
}
export function runWeb(files, frame, store, onStore, ms) {
  return new Promise(res => {
    const id = "r" + Math.random().toString(36).slice(2), r = { logs: [], errors: [], pass: [], fail: [] };
    let doneT = null, hardT = null, n = 0, ended = false, stT = null, lastStore = null;
    const fin = () => { if (ended) return; ended = true; window.removeEventListener("message", on); clearTimeout(doneT); clearTimeout(hardT); if (lastStore && onStore) onStore(lastStore); res(r) };
    const on = e => { const d = e.data; if (!d || d.__yai !== id || ended) return;
      if (++n > 1500) { r.errors.push("The app sent too many messages (possible infinite loop); stopped watching it."); return fin() }
      if (d.t === "store") { lastStore = d.a; clearTimeout(stT); stT = setTimeout(() => { onStore && onStore(lastStore) }, 400); return }
      if (r.logs.length > 200 && d.t !== "error" && d.t !== "pass" && d.t !== "fail" && d.t !== "done") return;
      if (d.t === "error") r.errors.push(d.a); else if (d.t === "pass") r.pass.push(d.a); else if (d.t === "fail") r.fail.push(d.a);
      else if (d.t === "done") { clearTimeout(doneT); doneT = setTimeout(fin, 600) } else r.logs.push({ k: d.t, a: d.a });
      if (d.t === "warn" || d.t === "error" && false) { } };
    window.addEventListener("message", on);
    frame.setAttribute("sandbox", "allow-scripts allow-modals allow-forms allow-popups");
    frame.srcdoc = buildDoc(files, id, store);
    doneT = setTimeout(fin, ms || 6000); hardT = setTimeout(() => { if (!ended) { r.errors.push("The app didn't finish loading within 15 seconds (it may be stuck in a loop or waiting on a dialog)."); fin() } }, 15000);
  });
}
let pyP = null;
async function pyodide() { if (!pyP) pyP = (async () => { await loadScript(PYODIDE); return await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" }) })(); try { return await pyP } catch (e) { pyP = null; throw e } }
export async function runPy(files, status) {
  const r = { logs: [], errors: [], pass: [], fail: [] };
  status && status("Loading Python (first time takes a few seconds)…");
  const py = await pyodide();
  py.setStdout({ batched: s => r.logs.push({ k: "log", a: s }) }); py.setStderr({ batched: s => r.logs.push({ k: "warn", a: s }) });
  try { py.FS.mkdirTree("/home/pyodide/proj") } catch (e) { }
  for (const [k, v] of Object.entries(files)) if (/\.py$/.test(k)) py.FS.writeFile("/home/pyodide/proj/" + k.split("/").pop(), v);
  await py.runPythonAsync(`import sys, importlib\nsys.path.insert(0, "/home/pyodide/proj") if "/home/pyodide/proj" not in sys.path else None\nfor _m in ["main","tests"]:\n    sys.modules.pop(_m, None)\nimportlib.invalidate_caches()`);
  const tb = e => String(e && e.message || e).split("\n").filter(l => !/_pyodide|pyodide\/|File "<exec>"/.test(l) || /line \d+/.test(l) && !/_pyodide/.test(l)).slice(-8).join("\n");
  const ns = py.globals.get("dict")(); ns.set("__name__", "__main__");
  status && status("Running main.py…");
  try { await py.runPythonAsync(files["main.py"] || "", { globals: ns }) } catch (e) { r.errors.push(tb(e)) }
  if (files["tests.py"]) {
    status && status("Running tests…");
    const tns = py.globals.get("dict")(); tns.set("__name__", "tests");
    try { await py.runPythonAsync(`from main import *\n`, { globals: tns }) } catch (e) { }
    try { await py.runPythonAsync(files["tests.py"], { globals: tns }) } catch (e) { r.fail.push("tests.py: " + tb(e)) }
    try { const res = await py.runPythonAsync(`_r=[]\nfor _n,_f in list(globals().items()):\n    if _n.startswith("test_") and callable(_f):\n        try:\n            _f(); _r.append("pass|"+_n)\n        except Exception as _e:\n            _r.append("fail|"+_n+": "+type(_e).__name__+(": "+str(_e) if str(_e) else ""))\n_r`, { globals: tns });
      for (const x of res.toJs()) { const [k, v] = x.split(/\|(.*)/s); (k === "pass" ? r.pass : r.fail).push(v) } res.destroy && res.destroy() } catch (e) { r.fail.push(tb(e)) }
  }
  return r;
}

/* ---------- the IDE view + agent ---------- */
export function mountIDE(root, ctx) {
  let P = ctx.loadProject(), sel = Object.keys(P.files)[0] || null, last = null, stop = false, ctrl = null;
  root.innerHTML = `<div class="bar"><span class="agent" id="agentSt">Ready</span></div>
   <div class="ftree" id="ftree"></div>
   <div class="bar"><button class="btn ghost" id="cpBtn">📋 Copy file</button><button class="btn ghost" id="runBtn">▶ Run</button><button class="btn ghost" id="exBtn">💡 Explain this code</button><button class="btn ghost" id="zipBtn">⬇ Download .zip</button><button class="btn ghost" id="newBtn">🗑 New project</button></div>
   <pre class="src" id="src"></pre>
   <iframe id="pv" title="Live preview" sandbox="allow-scripts"></iframe>
   <div class="tests" id="tests"></div>
   <div class="cons" id="cons" aria-live="polite">Console output shows here.</div>
   <button class="btn hidden" id="fixBtn">🛠 Fix Error with AI</button>`;
  const st = t => { $("#agentSt", root).textContent = t };
  const save = () => ctx.saveProject(P);
  function drawTree() { const t = $("#ftree", root); t.innerHTML = ""; const names = Object.keys(P.files);
    if (!names.length) t.innerHTML = '<span class="note" style="color:#6b6880;font-size:14px">No files yet. Describe an app, game, page or Python script.</span>';
    names.forEach(n => t.append(el("button", { class: n === sel ? "on" : "", onclick: () => { sel = n; drawTree() } }, n)));
    $("#src", root).textContent = sel && P.files[sel] != null ? P.files[sel] : ""; $("#src", root).classList.toggle("hidden", !sel);
    $("#pv", root).classList.toggle("hidden", isPython(P.files) || !Object.keys(P.files).length) }
  function showRun(r) {
    const c = $("#cons", root); c.innerHTML = "";
    r.logs.slice(-60).forEach(l => c.append(el("div", { class: l.k === "error" ? "e" : (l.k === "warn" ? "w" : "") }, l.a)));
    r.errors.forEach(e => c.append(el("div", { class: "e" }, "✖ " + e)));
    if (!r.logs.length && !r.errors.length) c.append(el("div", { class: "ok" }, "✓ Ran with no console output or errors."));
    const t = $("#tests", root); t.innerHTML = "";
    r.pass.forEach(p => t.append(el("span", {}, "✓ " + p))); r.fail.forEach(f => t.append(el("span", { class: "f" }, "✗ " + f)));
    if (r.pass.length + r.fail.length) t.prepend(el("b", { style: "font-size:13px;align-self:center" }, `Tests: ${r.pass.length} passed, ${r.fail.length} failed`));
    $("#fixBtn", root).classList.toggle("hidden", !(r.errors.length || r.fail.length)) }
  async function run() {
    if (!Object.keys(P.files).length) return { logs: [], errors: [], pass: [], fail: [] };
    let r;
    if (isPython(P.files)) { try { r = await runPy(P.files, st) } catch (e) { r = { logs: [], errors: ["Python could not start: " + (e.message || e)], pass: [], fail: [], infra: true } } }
    else { st("Running in the sandbox…"); r = await runWeb(P.files, $("#pv", root), P.store || {}, d => { P.store = d; save() }) }
    last = r; showRun(r); return r }
  const problems = r => [...r.errors, ...r.fail.map(f => "Failing test: " + f)];
  const filesCtx = () => Object.entries(P.files).map(([k, v]) => `FILE: ${k}\n\`\`\`\n${v.slice(0, 9000)}\n\`\`\``).join("\n\n").slice(0, 24000);
  async function applyOut(text) {
    const before = { ...P.files }; const parsed = parseOutput(text); const res = applyChanges(P.files, parsed);
    P.files = res.files; if (!sel || !P.files[sel]) sel = Object.keys(P.files).find(n => /index\.html|main\.py/.test(n)) || Object.keys(P.files)[0]; save(); drawTree();
    return { parsed, res, diff: res.changed.length ? diffHtml(before, P.files, res.changed) : "" } }
  async function fixLoop(r0, bubble, auto) {
    let r = r0, rounds = 0, hint = ""; const startN = problems(r0).length;
    while (problems(r).length && rounds < (auto ? MAX_FIX : 1) && !stop && !r.infra) {
      rounds++; st(`Fixing errors (round ${rounds} of ${auto ? MAX_FIX : 1})…`);
      let out; try { out = await ctx.ask("fix", [{ role: "user", content: `The project has these problems when run:\n${problems(r).join("\n").slice(0, 3000)}\n${hint}\nCurrent files:\n${filesCtx()}\n\nFix them.` }], ctrl.signal) } catch (e) { if (stop) break; ctx.note(bubble, "Couldn't reach the fixer: " + (e.message || e)); break }
      if (stop) break;
      const a = await applyOut(out); if (a.diff) ctx.note(bubble, "", a.diff, `Fix round ${rounds}: changed ${a.res.changed.join(", ")}`);
      if (!a.res.changed.length) { hint = a.res.failed.length ? `\nYour last EDIT did not apply (${a.res.failed.join("; ")}). This time return each changed file in full with 'FILE: <name>'.\n` : "\nYour last answer changed nothing. Return each changed file in full with 'FILE: <name>'.\n"; continue }
      hint = "";
      r = await run();
    }
    const fixed = Math.max(0, startN - problems(r).length);
    st(stop ? "Stopped" : (problems(r).length ? `${problems(r).length} problem${problems(r).length > 1 ? "s" : ""} left after ${rounds} fix round${rounds === 1 ? "" : "s"}` : (fixed ? `Fixed ${fixed} error${fixed > 1 ? "s" : ""} ✓` : "Ran clean ✓")));
    return { r, fixed, rounds };
  }
  async function agent(request, bubble, prev) {
    stop = false; ctrl = new AbortController(); ctx.busy(true, () => { stop = true; ctrl.abort(); st("Stopped") });
    try {
      st("Planning and writing code…");
      const has = Object.keys(P.files).length;
      const msgs = [...(prev || []).slice(-11), { role: "user", content: has ? `${request}\n\nCurrent project files (edit only what is needed; prefer EDIT search/replace blocks for small changes):\n${filesCtx()}` : request }];
      const out = await ctx.ask("code", msgs, ctrl.signal); if (stop) return;
      const a = await applyOut(out);
      const note = a.parsed.note || (a.res.changed.length ? "Done." : "");
      ctx.answer(bubble, (note || "I couldn't find code in that answer.") + (a.res.failed.length ? `\n\n_Some edits didn't apply: ${a.res.failed.join("; ")}_` : ""), out);
      if (a.diff) ctx.note(bubble, "", a.diff, `Changed ${a.res.changed.join(", ")}`);
      if (!a.res.changed.length) { st("No files changed"); return }
      const r = await run(); if (stop) return;
      const f = await fixLoop(r, bubble, true);
      ctx.note(bubble, (f.r.pass.length + f.r.fail.length ? `Tests: ${f.r.pass.length} passed, ${f.r.fail.length} failed. ` : "") + $("#agentSt", root).textContent);
    } catch (e) { if (!stop) { st("Error"); ctx.answer(bubble, ctx.errText(e)) } }
    finally { ctx.busy(false) }
  }
  $("#runBtn", root).onclick = () => run().then(r => st(problems(r).length ? `${problems(r).length} problem(s)` : "Ran clean ✓"));
  $("#fixBtn", root).onclick = async () => { if (!last) return; const b = ctx.bubble("Fix Error with AI"); stop = false; ctrl = new AbortController(); ctx.busy(true, () => { stop = true; ctrl.abort() }); try { await fixLoop(last, b, false); ctx.note(b, $("#agentSt", root).textContent) } finally { ctx.busy(false) } };
  $("#cpBtn", root).onclick = async () => { if (!sel) return; try { await navigator.clipboard.writeText(P.files[sel]); st("Copied " + sel) } catch (e) { st("Copy blocked by the browser") } };
  $("#exBtn", root).onclick = async () => { if (!Object.keys(P.files).length) return; const b = ctx.bubble("Explain this code"); ctrl = new AbortController(); ctx.busy(true, () => ctrl.abort()); try { ctx.answer(b, await ctx.ask("explain", [{ role: "user", content: "Explain this project:\n" + filesCtx() }], ctrl.signal)) } catch (e) { ctx.answer(b, ctx.errText(e)) } finally { ctx.busy(false) } };
  $("#zipBtn", root).onclick = async () => { if (!Object.keys(P.files).length) return; st("Zipping…"); try { await loadScript(JSZIP); const z = new window.JSZip(); for (const [k, v] of Object.entries(P.files)) z.file(k, v); const blob = await z.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "yathin-ai-project.zip"; a.click(); st("Downloaded .zip") } catch (e) { st("Zip failed: " + e.message) } };
  $("#newBtn", root).onclick = () => { if (Object.keys(P.files).length && !confirm("Start a new empty project? The current files will be cleared.")) return; P = { files: {}, store: {} }; sel = null; save(); ctx.clearHistory(); drawTree(); $("#cons", root).textContent = "Console output shows here."; $("#tests", root).innerHTML = ""; st("Ready") };
  drawTree(); if (Object.keys(P.files).length && !isPython(P.files)) run();
  return { agent, run, project: () => P };
}
