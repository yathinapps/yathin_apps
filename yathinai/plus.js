/* Yathin AI+ : Stripe checkout (7-day free trial), manage-plan portal, and the server-checked AI+ flag.
   Card details never touch this page: Stripe's own pages take them, and the brain asks Stripe who has paid. */
(function () {
  const BRAIN = "https://yathin-ai.yathinlooops.workers.dev";
  const sess = () => { try { const s = JSON.parse(localStorage.getItem("yai2-sess") || "null"); return s && s.u === localStorage.getItem("yai-user") && s.x > Date.now() ? s.t : undefined } catch (e) { } };
  const call = body => fetch(BRAIN, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ v: 2, mode: "billing", auth: sess(), ...body }) }).then(async r => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
  let ST = null, OFF = false;   // ST = last status from the brain; OFF = billing not switched on yet
  try { const c = JSON.parse(localStorage.getItem("yai-plus-st") || "null"); if (c && c.u === localStorage.getItem("yai-user") && Date.now() - c.at < 6 * 3600e3) ST = c.s } catch (e) { }
  async function refresh(fresh) {
    if (!sess()) { ST = null; render(); return }
    const { ok, j } = await call({ op: "status", fresh: !!fresh }).catch(() => ({ ok: false, j: {} }));
    if (j.error === "billing_off") OFF = true;
    else if (ok) { ST = j; localStorage.setItem("yai-plus-st", JSON.stringify({ u: localStorage.getItem("yai-user"), at: Date.now(), s: j })) }
    render();
  }
  window.YAIPlus = { isPlus: () => !!(ST && ST.plus), refresh };

  // the brain decides AI+ itself; this only asks it to check
  const of = window.fetch.bind(window);
  window.fetch = function (u, o) {
    try { if (u === BRAIN && o && typeof o.body === "string" && ST && ST.plus) { const b = JSON.parse(o.body); if (b.v === 2 && b.mode !== "billing" && !b.plus) { b.plus = true; o = { ...o, body: JSON.stringify(b) } } } } catch (e) { }
    return of(u, o);
  };

  async function go(op, plan, btn) {
    if (!sess()) { if (window.YAI2) window.YAI2.openLogin("Sign in with Google to start your AI+ free trial."); return }
    const t = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "Opening Stripe…" }
    const { j } = await call({ op, plan, ret: location.pathname }).catch(() => ({ j: {} }));
    if (j.url) { location.href = j.url; return }
    if (btn) { btn.disabled = false; btn.textContent = t }
    if (j.error === "already_plus") { refresh(true); return }
    alert(j.error === "login_required" ? "Sign in with Google first (email-only accounts can't buy AI+)." : "Couldn't open checkout right now. Please try again in a minute.");
  }
  const fmt = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  function render() {
    document.querySelectorAll(".plan.plus").forEach(card => {
      if (OFF) return;   // keep "Coming Soon" until Stripe is switched on
      let box = card.querySelector(".yai-plus-cta");
      const old = card.querySelector("button.btn[disabled]:not(.yai-plus-btn)"); if (old && !box) { box = document.createElement("div"); box.className = "yai-plus-cta"; old.replaceWith(box) }
      if (!box) return;
      const tag = card.querySelector(".tag"); const key = ST && ST.plus ? "on:" + ST.status + ST.periodEnd : "off:" + (ST && ST.hadTrial ? 1 : 0);
      if (box.dataset.k === key) return; box.dataset.k = key;
      box.innerHTML = "";
      const b = (txt, fn, ghost) => { const x = document.createElement("button"); x.className = "btn yai-plus-btn" + (ghost ? " ghost" : ""); x.style.cssText = "width:100%;margin-top:10px"; x.textContent = txt; x.onclick = () => fn(x); box.appendChild(x); return x };
      if (ST && ST.plus) {
        if (tag) tag.textContent = ST.status === "trialing" ? "Free trial" : "Your plan";
        const p = document.createElement("p"); p.style.cssText = "margin:10px 0 0;font-weight:600";
        p.textContent = ST.status === "trialing" && ST.trialEnd ? "You're on AI+. Free trial until " + fmt(ST.trialEnd) + "." : ST.status === "past_due" ? "You're on AI+, but your last payment didn't go through. Update your card." : "You're on AI+." + (ST.periodEnd ? (ST.renews ? " Renews " : " Ends ") + fmt(ST.periodEnd) + "." : "");
        box.appendChild(p); b("Manage plan", x => go("portal", "", x), true);
      } else {
        const trial = !(ST && ST.hadTrial);
        if (tag) tag.textContent = trial ? "7-day free trial" : "Available now";
        b(trial ? "Start free trial · $15.99/month after" : "Get AI+ · $15.99/month", x => go("checkout", "month", x));
        b(trial ? "Start free trial · $55.99/year after" : "Get AI+ · $55.99/year", x => go("checkout", "year", x), true);
        const n = document.createElement("p"); n.style.cssText = "margin:8px 0 0;font-size:13px;opacity:.75"; n.textContent = (trial ? "Free for 7 days, then billed automatically. " : "") + "Cancel anytime in Manage plan. Payments by Stripe."; box.appendChild(n);
      }
    });
  }
  new MutationObserver(() => { if (document.querySelector(".plan.plus")) render() }).observe(document.body, { childList: true, subtree: true });
  const q = new URLSearchParams(location.search).get("plus");
  if (q) { history.replaceState(null, "", location.pathname + location.hash); }
  if (q === "done") { refresh(true).then(() => { if (ST && ST.plus) alert(ST.status === "trialing" ? "Welcome to Yathin AI+! Your 7-day free trial has started." : "Welcome to Yathin AI+!"); }) } else refresh(false);
  window.addEventListener("storage", e => { if (e.key === "yai2-sess" || e.key === "yai-user") refresh(false) });
})();
