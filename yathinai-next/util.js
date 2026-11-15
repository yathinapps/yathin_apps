/* Yathin AI next: shared helpers */
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
export const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === "class") e.className = attrs[k]; else if (k.startsWith("on")) e[k] = attrs[k]; else if (k === "html") e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]) } kids.flat().forEach(x => x != null && e.append(x)); return e };

/* Hide model reasoning: <thinking>…</thinking> and <think>…</think>, closed or not, plus a half-typed tag at the end */
export function stripThink(t) {
  t = String(t || "");
  t = t.replace(/<(think|thinking)>[\s\S]*?<\/\1>/gi, "");
  const close = t.search(/<\/(think|thinking)>/i);
  if (close >= 0) t = t.slice(t.indexOf(">", close) + 1);
  t = t.replace(/<(think|thinking)>[\s\S]*$/i, "");
  t = t.replace(/<\/?(t(h(i(n(k(i(n(g)?)?)?)?)?)?)?)?$/i, "");
  return t.replace(/<\/?(think|thinking)>/gi, "").trim();
}

/* small, safe markdown: code fences, tables, headings, lists, bold, italics, inline code, links */
export function md(src) {
  src = stripThink(src);
  const blocks = []; src = src.replace(/```([\w.+-]*)[^\n]*\n?([\s\S]*?)(```|$)/g, (_, l, c) => { blocks.push(`<pre><code>${esc(c.replace(/\n$/, ""))}</code></pre>`); return `\u0000${blocks.length - 1}\u0000` });
  const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = src.split("\n"); let out = [], i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push(`<table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue;
    }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { out.push(`<h4>${inline(m[2])}</h4>`); i++; continue }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ord = /^\s*\d/.test(l); const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      out.push(`<${ord ? "ol" : "ul"}>${items.map(x => `<li>${inline(x)}</li>`).join("")}</${ord ? "ol" : "ul"}>`); continue;
    }
    if (/^\u0000\d+\u0000$/.test(l.trim())) { out.push(l.trim()); i++; continue }
    if (!l.trim()) { i++; continue }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s|\s*\|)/.test(lines[i]) && !/^\u0000\d+\u0000$/.test(lines[i].trim())) para.push(lines[i++]);
    if (!para.length) { out.push(inline(l)); i++; continue }
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, n) => blocks[n]).replace(/<p>/g, '<p style="margin:6px 0">');
}

export function getJson(out) {
  out = stripThink(out).replace(/```(json)?/gi, "");
  const a = out.indexOf("{"), b = out.lastIndexOf("}"); if (a < 0 || b < a) return null;
  const t = out.slice(a, b + 1);
  try { return JSON.parse(t) } catch (e) { try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")) } catch (x) { return null } }
}
export const fmtLeft = ms => { ms = Math.max(0, ms); const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); return h ? `${h}h ${m}m` : (m ? `${m}m ${s}s` : `${s}s`) };
export async function sha(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("") }
export function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`) && window.__ls && window.__ls[src]) return res(); const s = document.createElement("script"); s.src = src; s.onload = () => { (window.__ls = window.__ls || {})[src] = 1; res() }; s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.append(s) }) }
