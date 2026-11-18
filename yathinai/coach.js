/* Coach Yathin AI: owner-only screen for rules + example answers (the brain checks the verified Google sign-in) */
(function () {
  const BRAIN = "https://yathin-ai.yathinlooops.workers.dev", COACHES = ["praveenmarketing26@gmail.com"];
  const me = () => (localStorage.getItem("yai-user") || "").toLowerCase();
  const sess = () => { try { const s = JSON.parse(localStorage.getItem("yai2-sess") || "null"); return s && s.u === localStorage.getItem("yai-user") && s.x > Date.now() ? s.t : undefined } catch (e) { } };
  const srv = set => fetch(BRAIN, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ v: 2, mode: "coach", auth: sess(), ...(set ? { set } : {}) }) }).then(r => r.json());
  const B = "padding:9px 14px;border-radius:999px;border:1px solid #ddd;background:#fff;cursor:pointer;font:600 13px Geist,sans-serif";
  const TA = "width:100%;box-sizing:border-box;border-radius:12px;padding:10px;font:14px Geist,sans-serif;border:1px solid #ccc;margin-top:4px";
  function addBtn() {
    const fb = document.getElementById("fbBtn"); if (!fb) return;
    let b = document.getElementById("coachBtn");
    if (!b) { b = document.createElement("button"); b.id = "coachBtn"; b.type = "button"; b.textContent = "🎓 Coach Yathin AI"; b.style.cssText = "display:none;width:100%;box-sizing:border-box;margin-top:12px;padding:9px;border-radius:999px;border:1px solid #c4b5fd;background:#f5f3ff;cursor:pointer;font:600 13px Geist,sans-serif"; b.onclick = e => { e.stopPropagation(); open() }; fb.parentNode.insertBefore(b, fb) }
    b.style.display = COACHES.includes(me()) ? "block" : "none";
  }
  setInterval(addBtn, 1500); addBtn();
  async function open() {
    const d = document.createElement("div"); d.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Geist,sans-serif";
    d.innerHTML = '<div id="coBox" style="background:#fff;color:#1f2937;border-radius:22px;padding:22px;width:min(720px,100%);max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)"><b style="font-size:19px">🎓 Coach Yathin AI</b><p style="color:#6b7280;font-size:13px;margin:6px 0 12px">Pick a mode, then write rules and example answers for it. They apply for everyone. Changes apply within a minute.</p><div id="coBody">Loading…</div></div>';
    d.onclick = e => { if (e.target === d) d.remove() }; document.body.append(d);
    const body = d.querySelector("#coBody");
    if (!sess()) { body.innerHTML = 'Sign out and sign back in with <b>Google</b> as ' + COACHES[0] + ' to coach.'; return }
    let c; try { c = await srv() } catch (e) { c = { error: "busy" } }
    if (c.error) { body.textContent = c.error === "not_coach" ? "This account can't coach. Sign in with Google as " + COACHES[0] + "." : "Couldn't load right now. Try again in a bit."; return }
    c.modes = c.modes || {};
    const MODES = [["all", "🌐 All modes"], ["chat", "💬 Chat"], ["code", "💻 Code"], ["learn", "📚 Learn"], ["model", "🧊 3D"], ["image", "🎨 Images"], ["physics", "🧪 Physics"], ["shop", "🛍️ Shopping"], ["games", "🎮 Games"], ["vision", "📷 Pictures you send"]];
    let cur = "all";
    const tgt = () => cur === "all" ? c : (c.modes[cur] = c.modes[cur] || { rules: "", ex: [] });
    let ex = (c.ex || []).slice(); c.ex = ex;
    const has = k => { const t = k === "all" ? c : c.modes[k]; return t && ((t.rules || "").trim() || (t.ex || []).length) };
    const draw = () => {
      const T = tgt(); ex = T.ex = T.ex || [];
      body.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + MODES.map(([k, n]) => '<button data-k="' + k + '" style="' + B + ';padding:6px 11px;' + (k === cur ? 'background:#1f2937;color:#fff;border-color:#1f2937' : '') + '">' + n + (has(k) ? ' •' : '') + '</button>').join("") + '</div><div style="font-size:12px;color:#6b7280;margin:-4px 0 10px">' + (cur === "all" ? "Used in Chat, Code, Learn, Shopping and Pictures. Each mode's own coaching is added on top and wins if they disagree." : "Only for " + MODES.find(m => m[0] === cur)[1].replace(/^\S+ /, "") + ". Added on top of All modes" + (["model", "games", "image", "physics"].includes(cur) ? " (3D, Games, Images and Physics only use their own coaching, since they make code or pictures)" : "") + ".") + '</div><label style="font-weight:600;font-size:14px">Rules (one per line)</label><textarea id="coR" rows="7" maxlength="4000" style="' + TA + '" placeholder="Keep answers short and friendly.&#10;Always end with one helpful follow-up idea."></textarea><div style="font-weight:600;font-size:14px;margin:14px 0 6px">Example answers (' + ex.length + '/12)</div><div id="coEx"></div><button id="coAdd" style="' + B + '">+ Add example</button><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button id="coX" style="' + B + '">Close</button><button id="coS" style="' + B + ';background:#1f2937;color:#fff;border:0">Save coaching</button></div>' + (c.at ? '<div style="font-size:12px;color:#9ca3af;margin-top:8px">Last saved ' + new Date(c.at).toLocaleString() + '</div>' : '');
      const R = body.querySelector("#coR"); R.value = T.rules || ""; R.oninput = () => T.rules = R.value;
      body.querySelectorAll("[data-k]").forEach(x => x.onclick = () => { T.rules = R.value; cur = x.dataset.k; draw() });
      ex.forEach((e, i) => { const w = document.createElement("div"); w.style.cssText = "border:1px solid #e5e7eb;border-radius:14px;padding:10px;margin-bottom:8px";
        w.innerHTML = '<input maxlength="600" placeholder="When someone asks…" style="' + TA + '"><textarea rows="3" maxlength="1500" placeholder="Yathin AI should answer…" style="' + TA + '"></textarea><button style="' + B + ';margin-top:6px">Remove</button>';
        const q = w.querySelector("input"), a = w.querySelector("textarea"), rm = w.querySelector("button"); q.value = e.q; a.value = e.a;
        q.oninput = () => e.q = q.value; a.oninput = () => e.a = a.value; rm.onclick = () => { T.rules = R.value; ex.splice(i, 1); draw() };
        body.querySelector("#coEx").append(w) });
      body.querySelector("#coAdd").onclick = () => { if (ex.length >= 12) return; T.rules = R.value; ex.push({ q: "", a: "" }); draw() };
      body.querySelector("#coX").onclick = () => d.remove();
      body.querySelector("#coS").onclick = async () => { const s = body.querySelector("#coS"); s.disabled = true; s.textContent = "Saving…";
        try { T.rules = R.value; const ok = x => (x || []).filter(e => e.q.trim() && e.a.trim()); const modes = {}; for (const k in c.modes) modes[k] = { rules: c.modes[k].rules || "", ex: ok(c.modes[k].ex) };
          const j = await srv({ rules: c.rules || "", ex: ok(c.ex), modes }); if (j.error) throw 0; s.textContent = "Saved ✓"; setTimeout(() => d.remove(), 700) } catch (e) { s.disabled = false; s.textContent = "Couldn't save, try again" } };
    };
    draw();
  }
})();
