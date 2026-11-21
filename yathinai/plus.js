/* Yathin AI+ : Stripe checkout (7-day free trial), manage-plan portal, and the server-checked AI+ flag.
   Card details never touch this page: Stripe's own pages take them, and the brain asks Stripe who has paid. */
(function () {
  const BRAIN = "https://yathin-ai.yathinlooops.workers.dev";
  const PK = "pk_test_51Ue9J90p9AJnAeB3wNXiCsYHnWXdn04ekDVHrGnOcfhOQiKpwKew4yeuF6AuPUMwDb30uangOQKCWmdqiixQGSG100Ege29QiI";   // Stripe publishable key (pk_..., public by design). Empty = open Stripe's own page instead.
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
    try { if (u === BRAIN && o && typeof o.body === "string" && ST && ST.plus) { const b = JSON.parse(o.body); if (b.mode !== "billing" && !b.plus) { b.plus = true; o = { ...o, body: JSON.stringify(b) } } } } catch (e) { }
    return of(u, o);
  };

  async function go(op, plan, btn) {
    if (!sess()) { if (window.YAI2) window.YAI2.openLogin("Sign in with Google to start your AI+ free trial."); return }
    if (op === "checkout" && !(await adultOk())) return;
    if (op === "checkout" && PK) { embed(plan); return }
    const t = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "Opening Stripe…" }
    const { j } = await call({ op, plan, ret: location.pathname }).catch(() => ({ j: {} }));
    if (j.url) { location.href = j.url; return }
    if (btn) { btn.disabled = false; btn.textContent = t }
    if (j.error === "already_plus") { refresh(true); return }
    alert(j.error === "login_required" ? "Sign in with Google first (email-only accounts can't buy AI+)." : "Couldn't open checkout right now. Please try again in a minute.");
  }
  const box18 = html => { const m = document.createElement("div"); m.id = "yai18"; m.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px"; m.innerHTML = '<div style="background:#fff;border-radius:20px;width:min(380px,100%);padding:22px;font:15px Geist,system-ui,sans-serif;color:#111;box-shadow:0 20px 60px rgba(0,0,0,.3)">' + html + '</div>'; document.body.appendChild(m); return m };
  const no18 = () => { const m = box18('<b style="font-size:18px">AI+ is for adults</b><p style="margin:10px 0 16px;line-height:1.45">You need to be 18 or older to buy Yathin AI+. Ask a parent or guardian to get it for you.</p><button type="button" style="width:100%;padding:10px;border-radius:999px;border:0;background:#111;color:#fff;font:600 14px Geist,system-ui,sans-serif;cursor:pointer">OK</button>'); m.querySelector("button").onclick = () => m.remove() };
  async function adultOk() {   // the brain checks the birthday; the first one an account gives is kept
    const { j } = await call({ op: "age18" }).catch(() => ({ j: {} }));
    if (j.ok) return true;
    if (j.error === "under_18") { no18(); return false }
    if (j.error !== "need_bday") { alert("Couldn't check right now. Please try again in a minute."); return false }
    return new Promise(done => {
      const mx = new Date().toISOString().slice(0, 10);
      const m = box18('<b style="font-size:18px">What\'s your birthday?</b><p style="margin:8px 0 12px;line-height:1.45;color:#555">Yathin AI+ is for people 18 and older. You can only enter this once.</p><input type="date" max="' + mx + '" min="1900-01-01" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:12px;font:15px inherit"><div class="e" style="color:#c0392b;font-size:13px;min-height:18px;margin-top:6px"></div><div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="c" style="flex:1;padding:10px;border-radius:999px;border:1px solid #ddd;background:#fff;font:600 14px Geist,system-ui,sans-serif;cursor:pointer">Cancel</button><button type="button" class="k" style="flex:1;padding:10px;border-radius:999px;border:0;background:#111;color:#fff;font:600 14px Geist,system-ui,sans-serif;cursor:pointer">Continue</button></div>');
      const inp = m.querySelector("input"), er = m.querySelector(".e");
      m.querySelector(".c").onclick = () => { m.remove(); done(false) };
      m.querySelector(".k").onclick = async () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) { er.textContent = "Pick your birthday."; return }
        const { j } = await call({ op: "age18", bday: inp.value }).catch(() => ({ j: {} })); m.remove();
        if (j.ok) done(true); else { if (j.error === "under_18") no18(); else alert("Couldn't check right now. Please try again in a minute."); done(false) }
      };
    });
  }
  let SJ, EC;
  const loadStripe = () => SJ || (SJ = new Promise((ok, no) => { if (window.Stripe) return ok(window.Stripe(PK)); const sc = document.createElement("script"); sc.src = "https://js.stripe.com/v3/"; sc.onload = () => ok(window.Stripe(PK)); sc.onerror = no; document.head.appendChild(sc) }));
  function closeEmbed() { try { EC && EC.destroy() } catch (e) { } EC = null; const m = document.getElementById("yaiPay"); if (m) m.remove() }
  async function embed(plan) {   // Stripe's checkout inside a Yathin AI popup; card details stay inside Stripe's own frame
    closeEmbed();
    const m = document.createElement("div"); m.id = "yaiPay";
    m.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px";
    m.innerHTML = '<div style="position:relative;background:#fff;border-radius:20px;width:min(1000px,100%);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eee;font:700 16px Geist,system-ui,sans-serif;color:#111">Yathin AI+<button type="button" aria-label="Close" style="border:0;background:#f2f2f2;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:18px">×</button></div><div id="yaiPayBox" style="min-height:420px;padding:8px"><p style="text-align:center;margin-top:160px;font:500 14px system-ui;color:#666">Loading secure checkout…</p></div></div>';
    m.querySelector("button").onclick = closeEmbed; m.onclick = e => { if (e.target === m) closeEmbed() };
    document.body.appendChild(m);
    try {
      const stripe = await loadStripe();
      const fetchClientSecret = async () => { const { j } = await call({ op: "checkout", plan, ret: location.pathname, embed: true }); if (!j.clientSecret) throw new Error(j.error || "no_secret"); return j.clientSecret };
      const init = stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout;
      EC = await init.call(stripe, { fetchClientSecret });
      const box = document.getElementById("yaiPayBox"); if (!box) { closeEmbed(); return } box.innerHTML = ""; EC.mount(box);
    } catch (e) {
      closeEmbed();
      if (String(e.message) === "already_plus") { refresh(true); return }
      if (String(e.message) === "under_18") { no18(); return }
      alert(String(e.message) === "login_required" ? "Sign in with Google first (email-only accounts can't buy AI+)." : "Couldn't open checkout right now. Please try again in a minute.");
    }
  }
  const fmt = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  function renderProf() {        // the old page's profile menu box
    const card = document.querySelector("#prof .plus"); if (!card || OFF) return;
    const key = ST && ST.plus ? "on:" + ST.status + ST.periodEnd : "off:" + (ST && ST.hadTrial ? 1 : 0) + (sess() ? 1 : 0);
    if (card.dataset.k === key) return; card.dataset.k = key;
    const tag = card.querySelector("span"); let box = card.querySelector(".yai-plus-cta");
    if (!box) { box = document.createElement("div"); box.className = "yai-plus-cta"; card.appendChild(box) }
    box.innerHTML = "";
    const b = (txt, fn, gold) => { const x = document.createElement("button"); x.type = "button"; x.textContent = txt; x.style.cssText = "display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border-radius:999px;cursor:pointer;font:600 12.5px Geist,sans-serif;" + (gold ? "border:0;background:linear-gradient(135deg,#f5b301,#e08a00);color:#fff" : "border:1px solid #ddd;background:#fff;color:#111"); x.onclick = e => { e.stopPropagation(); go(fn[0], fn[1], x) }; box.appendChild(x) };
    if (ST && ST.plus) {
      if (tag) tag.textContent = ST.status === "trialing" ? "FREE TRIAL" : "YOUR PLAN";
      const pt = document.getElementById("planTxt"); if (pt) pt.textContent = "Yathin AI+ ✨";
      const p = document.createElement("div"); p.style.cssText = "margin-top:8px;font-weight:600";
      p.textContent = ST.status === "trialing" && ST.trialEnd ? "Free trial until " + fmt(ST.trialEnd) + "." : ST.status === "past_due" ? "Last payment didn't go through. Update your card." : ST.periodEnd ? (ST.renews ? "Renews " : "Ends ") + fmt(ST.periodEnd) + "." : "";
      box.appendChild(p); b("Manage plan", ["portal", ""]);
    } else {
      const trial = !(ST && ST.hadTrial);
      if (tag) tag.textContent = trial ? "7-DAY FREE TRIAL" : "AVAILABLE NOW";
      b(trial ? "Try free · then $15.99/month" : "Get AI+ · $15.99/month", ["checkout", "month"], true);
      b(trial ? "Try free · then $55.99/year" : "Get AI+ · $55.99/year", ["checkout", "year"]);
      const n = document.createElement("div"); n.style.cssText = "margin-top:6px;font-size:11.5px;opacity:.7"; n.textContent = (trial ? "Free for 7 days, then billed automatically. " : "") + "Cancel anytime. Payments by Stripe."; box.appendChild(n);
    }
  }
  function render() {
    renderProf();
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
  new MutationObserver(() => { if (document.querySelector(".plan.plus,#prof .plus")) render() }).observe(document.body, { childList: true, subtree: true });
  const q = new URLSearchParams(location.search).get("plus");
  if (q) { history.replaceState(null, "", location.pathname + location.hash); }
  if (q === "done") { refresh(true).then(() => { if (ST && ST.plus) alert(ST.status === "trialing" ? "Welcome to Yathin AI+! Your 7-day free trial has started." : "Welcome to Yathin AI+!"); }) } else refresh(false);
  window.addEventListener("storage", e => { if (e.key === "yai2-sess" || e.key === "yai-user") refresh(false) });
})();
