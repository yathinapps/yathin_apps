/* Yathin AI next: 3D model viewer (build3d.js parts -> three.js, STL export) and a small physics engine */
let T = null, OC = null;
async function three() { if (!T) { T = await import("three"); OC = (await import("three/addons/controls/OrbitControls.js")).OrbitControls } return T }
let stopPrev = null;
function setup(el, THREE) {
  if (stopPrev) stopPrev(); el.innerHTML = "";
  const W = el.clientWidth || 600, H = el.clientHeight || 420;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.setPixelRatio(Math.min(2, devicePixelRatio)); el.append(r.domElement);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, W / H, .1, 5000);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(50, 80, 60); sc.add(dl);
  const oc = new OC(cam, r.domElement); let alive = true;
  const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (w && h) { r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix() } }); ro.observe(el);
  stopPrev = () => { alive = false; ro.disconnect(); r.dispose() };
  return { r, sc, cam, oc, alive: () => alive };
}
/* ---- 3D printable model ---- */
export async function show3D(el, j) {
  const THREE = await three(); const { STLExporter } = await import("three/addons/exporters/STLExporter.js"); const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
  const { r, sc, cam, oc, alive } = setup(el, THREE); const g = new THREE.Group(), d2r = Math.PI / 180;
  const geoOf = (p, s) => { switch (p.shape) {
    case "cylinder": return new THREE.CylinderGeometry(s[0], s[2] || s[0], s[1], 40);
    case "cone": return new THREE.ConeGeometry(s[0], s[1], 40);
    case "sphere": return new THREE.SphereGeometry(s[0], 40, 28);
    case "dome": return new THREE.SphereGeometry(s[0], 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    case "torus": return new THREE.TorusGeometry(s[0], s[1] || 2, 20, 48);
    case "pyramid": { const q = new THREE.ConeGeometry(s[0] * Math.SQRT1_2, s[1], 4); q.rotateY(Math.PI / 4); return q }
    case "prism": { const sh = new THREE.Shape(); sh.moveTo(-s[0] / 2, -s[1] / 2); sh.lineTo(s[0] / 2, -s[1] / 2); sh.lineTo(0, s[1] / 2); sh.closePath(); const q = new THREE.ExtrudeGeometry(sh, { depth: s[2], bevelEnabled: false }); q.translate(0, 0, -s[2] / 2); return q }
    case "tube": { const sh = new THREE.Shape(); sh.absarc(0, 0, s[0], 0, Math.PI * 2); const h = new THREE.Path(); h.absarc(0, 0, Math.min(s[2] || s[0] * .7, s[0] * .95), 0, Math.PI * 2, true); sh.holes.push(h); const q = new THREE.ExtrudeGeometry(sh, { depth: s[1], bevelEnabled: false, curveSegments: 40 }); q.rotateX(-Math.PI / 2); q.translate(0, -s[1] / 2, 0); return q }
    case "arch": { const w = s[0], ht = s[1], t = Math.max(1, Math.min(w, ht) * .18), rr = w / 2 - t, sh = new THREE.Shape(); sh.moveTo(-w / 2, -ht / 2); sh.lineTo(w / 2, -ht / 2); sh.lineTo(w / 2, ht / 2); sh.lineTo(-w / 2, ht / 2); sh.closePath(); const h = new THREE.Path(); const top = ht / 2 - t - rr; h.moveTo(-rr, -ht / 2); h.lineTo(rr, -ht / 2); h.lineTo(rr, top); h.absarc(0, top, rr, 0, Math.PI, false); h.lineTo(-rr, -ht / 2); sh.holes.push(h); const q = new THREE.ExtrudeGeometry(sh, { depth: s[2], bevelEnabled: false, curveSegments: 24 }); q.translate(0, 0, -s[2] / 2); return q }
    default: return new THREE.BoxGeometry(s[0], s[1], s[2]) } };
  const byC = {}, o3 = new THREE.Object3D(); let n = 0;
  const add = (geo, p, q) => { if (++n > 4000) return; o3.position.set(q[0], q[1], q[2]); const rt = (p.rot || [0, 0, 0]).map(Number); o3.rotation.set((rt[0] || 0) * d2r, (rt[1] || 0) * d2r, (rt[2] || 0) * d2r); o3.updateMatrix(); let gg = geo.index ? geo.toNonIndexed() : geo; gg.deleteAttribute("uv"); gg.applyMatrix4(o3.matrix); const c = String(p.color || "#8b5cf6").toLowerCase(); (byC[c] = byC[c] || []).push(gg) };
  const parts = window.YB ? window.YB.expand(j.parts || []) : (j.parts || []);
  for (const p of parts) { const s = (p.size || [10, 10, 10]).map(Number); const q0 = (p.pos || [0, 0, 0]).map(Number); const rp = Array.isArray(p.repeat) ? p.repeat.map(Number) : [1, 0, 0, 0]; const cnt = Math.max(1, Math.min(40, rp[0] || 1));
    for (let k = 0; k < cnt; k++) { const q = [q0[0] + k * (rp[1] || 0), q0[1] + k * (rp[2] || 0), q0[2] + k * (rp[3] || 0)];
      if (p.shape === "stairs") { const stp = Math.max(2, Math.min(30, +p.steps || 6)); for (let i = 0; i < stp; i++) { const h = s[1] * (i + 1) / stp; add(new THREE.BoxGeometry(s[0], h, s[2] / stp), p, [q[0], q[1] - s[1] / 2 + h / 2, q[2] - s[2] / 2 + s[2] / stp * (i + .5)]) } }
      else add(geoOf(p, s), p, q) } }
  for (const c in byC) { let mg; try { mg = mergeGeometries(byC[c], false) } catch (e) { mg = null } const mt = new THREE.MeshStandardMaterial({ color: c, roughness: .6 }); if (mg) g.add(new THREE.Mesh(mg, mt)); else byC[c].forEach(x => g.add(new THREE.Mesh(x, mt))) }
  sc.add(g); const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()).length() || 50, c = bb.getCenter(new THREE.Vector3());
  cam.position.set(c.x + sz * .62, c.y + sz * .42, c.z + sz * .62); oc.target.copy(c); oc.autoRotate = true;
  (function loop() { if (!alive()) return; oc.update(); r.render(sc, cam); requestAnimationFrame(loop) })();
  const stl = new STLExporter().parse(g, { binary: true });
  return { pieces: parts.length, stl: new Blob([stl], { type: "model/stl" }) };
}
/* ---- physics: gravity, ground and sphere collisions, or an orbit system ---- */
export async function simulate(el, S, ui) {
  const THREE = await three(); const { r, sc, cam, oc, alive } = setup(el, THREE);
  const V = (a, d) => Array.isArray(a) && a.length === 3 && a.every(x => isFinite(+x)) ? a.map(Number) : d;
  let g = isFinite(+S.gravity) ? +S.gravity : 9.81, massK = 1, paused = false;
  const orbit = !!S.orbit;
  let bodies = (Array.isArray(S.bodies) ? S.bodies : []).slice(0, 14).map((b, i) => {
    const shape = b.shape === "box" ? "box" : "sphere";
    const size = V(b.size, null); let rad = Math.max(.2, Math.min(orbit ? 8 : 6, +b.radius || (size ? Math.max(...size) / 2 : 1)));
    const pos = V(b.pos, [i * 3 - 6, 5 + i * 2, 0]), vel = V(b.vel, [0, 0, 0]);
    return { name: String(b.name || "Body " + (i + 1)), shape, rad, size: size ? size.map(x => Math.max(.2, Math.min(12, x))) : [rad * 2, rad * 2, rad * 2], m: Math.max(.01, +b.mass || 1), p: pos, v: vel, fixed: !!b.fixed, e: Math.min(.98, Math.max(0, isFinite(+b.restitution) ? +b.restitution : .6)), color: /^#[0-9a-f]{3,8}$/i.test(b.color || "") ? b.color : ["#8b5cf6", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"][i % 6] } });
  if (orbit) { // make it a working orbit system no matter what the model guessed
    let sun = bodies.find(b => b.fixed) || bodies.reduce((a, b) => b.m > a.m ? b : a, bodies[0]);
    if (sun) { sun.fixed = true; sun.p = [0, 0, 0]; sun.v = [0, 0, 0]; sun.rad = Math.max(2, Math.min(6, sun.rad));
      let k = 0; bodies.forEach(b => { if (b === sun) return; k++; let d = Math.hypot(b.p[0], b.p[2]); if (!(d > sun.rad + 2)) d = sun.rad + 4 + k * 5; d = Math.min(d, 55); const a = Math.atan2(b.p[2], b.p[0]) || k * 1.3; b.p = [Math.cos(a) * d, 0, Math.sin(a) * d]; b.rad = Math.min(b.rad, 2.2) }) }
    S.sun = sun;
  }
  const meshes = bodies.map(b => { const geo = b.shape === "box" ? new THREE.BoxGeometry(...b.size) : new THREE.SphereGeometry(b.rad, 32, 20); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color, roughness: .5, emissive: orbit && b.fixed ? b.color : 0x000000, emissiveIntensity: orbit && b.fixed ? .6 : 0 })); sc.add(m); return m });
  if (!orbit && S.ground !== false) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: g < 5 && g > 3 ? "#d4875a" : (g < 2 ? "#c9c9d1" : "#cdeccf"), roughness: .9 })); gr.rotation.x = -Math.PI / 2; sc.add(gr); sc.add(new THREE.GridHelper(140, 28, 0xffffff, 0xffffff)) }
  const trails = orbit ? bodies.map(b => { const geo = new THREE.BufferGeometry(); const arr = new Float32Array(600 * 3); geo.setAttribute("position", new THREE.BufferAttribute(arr, 3)); geo.setDrawRange(0, 0); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: .5 })); sc.add(l); return { geo, arr, n: 0 } }) : [];
  const GM0 = 3000;
  function initOrbitVel() { const sun = S.sun; if (!sun) return; bodies.forEach(b => { if (b === sun) return; const d = Math.hypot(b.p[0], b.p[2]) || 1; const v = Math.sqrt(GM0 * massK / d); b.v = [-b.p[2] / d * v, 0, b.p[0] / d * v] }) }
  const start = JSON.stringify(bodies.map(b => ({ p: b.p, v: b.v }))); if (orbit) initOrbitVel();
  const half = b => b.shape === "box" ? b.size[1] / 2 : b.rad, cr = b => b.shape === "box" ? Math.max(...b.size) / 2 : b.rad;
  function step(dt) {
    for (const b of bodies) { if (b.fixed) continue;
      if (orbit) { const sun = S.sun; const dx = sun.p[0] - b.p[0], dy = sun.p[1] - b.p[1], dz = sun.p[2] - b.p[2], d2 = dx * dx + dy * dy + dz * dz + 1, d = Math.sqrt(d2), a = GM0 * massK / d2; b.v[0] += a * dx / d * dt; b.v[1] += a * dy / d * dt; b.v[2] += a * dz / d * dt }
      else b.v[1] -= g * dt;
      b.v = b.v.map(x => x * (orbit ? 1 : .9995)); for (let k = 0; k < 3; k++) b.p[k] += b.v[k] * dt;
      if (!orbit && S.ground !== false && b.p[1] < half(b)) { b.p[1] = half(b); if (b.v[1] < 0) b.v[1] = -b.v[1] * b.e; b.v[0] *= .985; b.v[2] *= .985; if (Math.abs(b.v[1]) < .05) b.v[1] = 0 }
      for (let k of [0, 2]) if (Math.abs(b.p[k]) > 68) { b.p[k] = Math.sign(b.p[k]) * 68; b.v[k] *= -b.e } }
    if (!orbit) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) { const A = bodies[i], B = bodies[j]; if (A.fixed && B.fixed) continue;
      const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], dz = B.p[2] - A.p[2], d = Math.hypot(dx, dy, dz) || 1e-6, min = cr(A) + cr(B); if (d >= min) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d, ma = A.fixed ? Infinity : A.m * massK, mb = B.fixed ? Infinity : B.m * massK, ia = A.fixed ? 0 : 1 / ma, ib = B.fixed ? 0 : 1 / mb, pen = min - d;
      A.p[0] -= nx * pen * ia / (ia + ib); A.p[1] -= ny * pen * ia / (ia + ib); A.p[2] -= nz * pen * ia / (ia + ib); B.p[0] += nx * pen * ib / (ia + ib); B.p[1] += ny * pen * ib / (ia + ib); B.p[2] += nz * pen * ib / (ia + ib);
      const rv = (B.v[0] - A.v[0]) * nx + (B.v[1] - A.v[1]) * ny + (B.v[2] - A.v[2]) * nz; if (rv > 0) continue; const e = Math.min(A.e, B.e), jj = -(1 + e) * rv / (ia + ib);
      A.v[0] -= jj * nx * ia; A.v[1] -= jj * ny * ia; A.v[2] -= jj * nz * ia; B.v[0] += jj * nx * ib; B.v[1] += jj * ny * ib; B.v[2] += jj * nz * ib }
  }
  const bb = new THREE.Box3(); bodies.forEach(b => bb.expandByPoint(new THREE.Vector3(...b.p))); const c = bb.getCenter(new THREE.Vector3()), sz = Math.max(orbit ? 20 : 14, bb.getSize(new THREE.Vector3()).length());
  if (orbit) cam.position.set(0, sz * .9, sz * 1.0); else cam.position.set(c.x + sz * .55, Math.max(4, c.y * .5 + sz * .28), c.z + sz * 1.05); oc.target.set(c.x, orbit ? 0 : Math.max(0, c.y * .45), c.z);
  let lt = performance.now(), simT = 0;
  (function loop(now) { if (!alive()) return; requestAnimationFrame(loop); const dt = Math.min(.05, ((now || performance.now()) - lt) / 1000); lt = now || performance.now();
    if (!paused) { const n = orbit ? 8 : 4; for (let i = 0; i < n; i++) step(dt / n); simT += dt }
    bodies.forEach((b, i) => { meshes[i].position.set(...b.p); if (orbit && trails[i] && !b.fixed && !paused) { const t = trails[i]; if (t.n >= 600) { t.arr.copyWithin(0, 3); t.n = 599 } t.arr.set(b.p, t.n * 3); t.n++; t.geo.setDrawRange(0, t.n); t.geo.attributes.position.needsUpdate = true } });
    oc.update(); r.render(sc, cam); ui && ui.tick && ui.tick(simT, bodies) })();
  return {
    setGravity: v => { g = v }, setMass: v => { massK = v; if (orbit) initOrbitVel() }, pause: () => (paused = !paused),
    reset: () => { const s0 = JSON.parse(start); bodies.forEach((b, i) => { b.p = s0[i].p.slice(); b.v = s0[i].v.slice() }); if (orbit) { initOrbitVel(); trails.forEach(t => { t.n = 0; t.geo.setDrawRange(0, 0) }) } simT = 0 },
    gravity: () => g, orbit, bodies
  };
}
