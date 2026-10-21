import { W, H } from "./worlds.js";

export const CELL = 12;
export const COLS = W / CELL;
export const ROWS = H / CELL;
export const PIP_RANGE = 64;
export const BOB_SENSE = 34;
const REACH = 24;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function buildGrid(def) {
  const blocked = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      let b = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      for (const k of def.blocks) if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) b = true;
      for (const [px, py, pr] of def.piles) if (Math.hypot(x - px, y - py) < pr) b = true;
      for (const f of def.fires) if (Math.hypot(x - f.x, y - f.y) < f.r + 10) b = true;
      blocked[r * COLS + c] = b ? 1 : 0;
    }
  }
  const tight = new Uint8Array(COLS * ROWS);
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (blocked[r * COLS + c]) continue;
      let t = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (blocked[(r + dr) * COLS + c + dc]) t = 1;
      tight[r * COLS + c] = t;
    }
  }
  return { blocked, tight };
}

const cellOf = (x, y) => ({ c: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), r: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))) });

export function isBlocked(sim, x, y) {
  const { c, r } = cellOf(x, y);
  return sim.grid.blocked[r * COLS + c] === 1;
}

export function isTight(sim, x, y) {
  const { c, r } = cellOf(x, y);
  return sim.grid.tight[r * COLS + c] === 1;
}

function nearestFree(sim, x, y) {
  const o = cellOf(x, y);
  for (let rad = 0; rad < 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
      const c = o.c + dc, r = o.r + dr;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      if (!sim.grid.blocked[r * COLS + c]) return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
    }
  }
  return null;
}

function lineClear(sim, a, b) {
  const n = Math.max(1, Math.ceil(dist(a, b) / 3));
  const dx = (b.x - a.x) / Math.max(1, dist(a, b)), dy = (b.y - a.y) / Math.max(1, dist(a, b));
  for (let i = 0; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
    if (isBlocked(sim, x, y) || isBlocked(sim, x - dy * 4, y + dx * 4) || isBlocked(sim, x + dy * 4, y - dx * 4)) return false;
  }
  return true;
}

export function findPath(sim, from, to) {
  const goalPt = isBlocked(sim, to.x, to.y) ? nearestFree(sim, to.x, to.y) : to;
  const startPt = isBlocked(sim, from.x, from.y) ? nearestFree(sim, from.x, from.y) : from;
  if (!goalPt || !startPt) return null;
  const s = cellOf(startPt.x, startPt.y), g = cellOf(goalPt.x, goalPt.y);
  const id = (c, r) => r * COLS + c, start = id(s.c, s.r), goal = id(g.c, g.r);
  const gs = new Map([[start, 0]]), parent = new Map(), open = [start], done = new Set();
  const centre = (i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
  const h = (i) => dist(centre(i), centre(goal));
  const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !sim.grid.blocked[id(c, r)];
  while (open.length) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (gs.get(open[i]) + h(open[i]) < gs.get(open[k]) + h(open[k])) k = i;
    const cur = open.splice(k, 1)[0];
    if (cur === goal) break;
    done.add(cur);
    const cc = cur % COLS, cr = Math.floor(cur / COLS);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const nc = cc + dc, nr = cr + dr, n = id(nc, nr);
      if (!free(nc, nr) || done.has(n)) continue;
      if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue;
      const step = (dc && dr ? 1.414 : 1) * (sim.grid.tight[n] ? 2.4 : 1);
      const ng = gs.get(cur) + step;
      if (!gs.has(n) || ng < gs.get(n)) { gs.set(n, ng); parent.set(n, cur); if (!open.includes(n)) open.push(n); }
    }
  }
  if (!gs.has(goal)) return null;
  const pts = [];
  for (let n = goal; n !== start; n = parent.get(n)) pts.unshift(centre(n));
  pts.push({ x: goalPt.x, y: goalPt.y });
  const out = [];
  let cur = startPt, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(sim, cur, pts[j])) j--;
    out.push(pts[j]); cur = pts[j]; i = j + 1;
  }
  return out;
}

function scanRoute(def, zone, gap = 84) {
  const z = zone || def.zone, pts = [];
  const rows = Math.max(2, Math.ceil((z.h - 50) / gap) + 1);
  for (let i = 0; i < rows; i++) {
    const y = z.y + 36 + i * ((z.h - 72) / (rows - 1));
    const a = z.x + 30, b = z.x + z.w - 30;
    pts.push(i % 2 ? { x: b, y } : { x: a, y });
    pts.push(i % 2 ? { x: a, y } : { x: b, y });
  }
  const lim = zone ? null : def.flyMaxX;
  return lim ? pts.map((p) => ({ x: Math.min(p.x, lim), y: p.y })) : pts;
}

export function createSim(def, opts = {}) {
  const sim = {
    def, frame: 0,
    bob: { x: def.base.x, y: def.base.y, a: def.base.a || 0, squeeze: 0 },
    pip: null, pipOn: opts.pipOn !== false, pipLeft: 3, pipBat: 100,
    battery: 100, manual: false,
    survivors: def.survivors.map((s, i) => ({ ...s, id: i, state: "unknown", reached: false, aided: false, look: i % 4, foundAt: 0 })),
    events: [], target: null, path: [], auto: null, finished: null, explore: null, trail: [],
    grid: buildGrid(def), cover: new Uint8Array(COLS * ROWS),
  };
  return sim;
}

const emit = (sim, type, text, kind, extra) => sim.events.push({ type, text, kind: kind || "info", frame: sim.frame, ...extra });

export function goTo(sim, p, stop = 6, label) {
  const route = findPath(sim, sim.bob, p);
  if (!route) { emit(sim, "log", "No safe route found.", "alert"); return false; }
  sim.target = { x: p.x, y: p.y, stop, label };
  sim.path = route;
  return true;
}

export function launchPip(sim) {
  if (!sim.pipOn) { emit(sim, "log", "Pip isn't on board.", "info"); return false; }
  if (sim.pip) return false;
  sim.pip = { x: sim.bob.x, y: sim.bob.y, state: "out", route: scanRoute(sim.def), ri: 0, aid: [], orbit: 0, spin: 0 };
  emit(sim, "log", "Pip launched from Bob's hangar.", "info", { sound: "launch" });
  return true;
}

export function recallPip(sim) {
  if (sim.pip && sim.pip.state !== "back") { sim.pip.state = "back"; emit(sim, "log", "Pip is coming back to Bob.", "info"); }
}

export function setPipOn(sim, on) {
  sim.pipOn = on;
  if (!on) recallPip(sim);
}

export function requestAid(sim, sv) {
  if (!sim.pipOn || sim.pipLeft <= 0 || sv.aided) return false;
  const lim = sim.def.flyMaxX;
  if (lim && sv.x > lim) {
    if (!sv.aidNoted) { sv.aidNoted = true; emit(sim, "log", "Pip can't reach this survivor: the roof is solid rock here.", "alert"); }
    return false;
  }
  if (!sim.pip) launchPip(sim);
  if (!sim.pip || sim.pip.aid.includes(sv)) return false;
  sim.pip.aid.push(sv);
  if (sim.pip.state === "back") sim.pip.state = "out";
  return true;
}

export function nextSignal(sim) {
  const open = sim.survivors.filter((s) => s.state === "signal" && !s.reached);
  open.sort((a, b) => dist(sim.bob, a) - dist(sim.bob, b));
  return open[0] || null;
}

export function sendBobToSignal(sim) {
  const s = nextSignal(sim);
  if (!s) { emit(sim, "log", "No heat signatures to follow yet. Launch Pip to scan.", "info"); return false; }
  emit(sim, "log", "Bob is heading to the heat signature " + s.note + ".", "info");
  return goTo(sim, s, REACH - 4, "signal");
}

export function temperature(sim, p) {
  let t = 24;
  for (const f of sim.def.fires) {
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d < f.r + 120) t = Math.max(t, 24 + 420 * (1 - Math.max(0, d - f.r) / 120));
  }
  return t;
}

function detect(sim, src, range, by) {
  for (const s of sim.survivors) {
    if (s.state !== "unknown" || dist(src, s) > range) continue;
    s.state = "signal"; s.foundAt = sim.frame;
    if (by === "pip") emit(sim, "signal", "Pip found a heat signature " + s.note + ".", "ok", { survivor: s, banner: "HEAT SIGNATURE" });
    else emit(sim, "signal", "Bob found a heat signature " + s.note + ".", "ok", { survivor: s, banner: "HEAT SIGNATURE" });
  }
}

function stepPip(sim) {
  const p = sim.pip;
  p.spin += 0.9; sim.pipBat = Math.max(0, sim.pipBat - 0.0075);
  if (sim.pipBat < 22 && p.state !== "back") { p.state = "back"; p.aid.length = 0; emit(sim, "log", "Pip's battery is low. It is coming back.", "alert"); }
  let goal;
  if (p.state === "out") {
    if (p.aid.length) goal = p.aid[0];
    else goal = p.route[Math.min(p.ri, p.route.length - 1)];
  } else goal = sim.bob;
  const d = dist(p, goal), v = p.state === "back" ? 5.5 : 4.6;
  if (d > 1) { const m = Math.min(v, d); p.x += (goal.x - p.x) / d * m; p.y += (goal.y - p.y) / d * m; }
  const lim = sim.def.flyMaxX;
  if (lim && p.x > lim) p.x = lim;
  if (!lim || p.x <= lim) detect(sim, p, PIP_RANGE, "pip");
  if (p.state === "out") {
    if (p.aid.length) {
      if (dist(p, p.aid[0]) < 10) {
        const sv = p.aid.shift();
        if (sim.pipLeft > 0 && !sv.aided) {
          sv.aided = true; sv.aidFrame = sim.frame; sim.pipLeft--;
          emit(sim, "aid", "Aid dropped: Pip placed a first-aid packet beside the survivor " + sv.note + ".", "ok", { survivor: sv, banner: "AID DROPPED" });
        }
      }
    } else if (dist(p, p.route[Math.min(p.ri, p.route.length - 1)]) < 8) {
      p.ri++;
      if (p.ri >= p.route.length) { p.state = "back"; emit(sim, "log", "Pip finished scanning the zone.", "info"); }
    }
  } else if (dist(p, sim.bob) < 14) {
    emit(sim, "log", "Pip docked in Bob's hangar. Battery " + Math.round(sim.pipBat) + "%.", "ok");
    sim.pip = null;
  }
}

function markCover(sim, p, range) {
  const o = cellOf(p.x, p.y), n = Math.ceil(range / CELL);
  for (let dr = -n; dr <= n; dr++) for (let dc = -n; dc <= n; dc++) {
    const c = o.c + dc, r = o.r + dr;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
    if (Math.hypot(dc, dr) * CELL <= range) sim.cover[r * COLS + c] = 1;
  }
}

function nextUnexplored(sim) {
  const z = sim.def.explore || sim.def.zone;
  let best = null, bd = Infinity;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    if (sim.grid.blocked[i] || sim.cover[i] || x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
    const d = Math.hypot(x - sim.bob.x, y - sim.bob.y);
    if (d < bd) { bd = d; best = { x, y, i }; }
  }
  return best;
}

function stepBob(sim, keys) {
  const b = sim.bob;
  if (sim.frame % 4 === 0) markCover(sim, b, BOB_SENSE * (sim.def.hazards === "smoke" ? 0.7 : 1) * 0.8);
  let manual = false;
  if (keys && (keys.left || keys.right || keys.up || keys.down)) {
    manual = true;
    if (keys.left) b.a -= 0.06;
    if (keys.right) b.a += 0.06;
    const sp = (isTight(sim, b.x, b.y) ? 1.1 : 2.3) * (keys.up ? 1 : keys.down ? -0.6 : 0);
    const nx = b.x + Math.cos(b.a) * sp, ny = b.y + Math.sin(b.a) * sp;
    if (!isBlocked(sim, nx, ny)) { b.x = nx; b.y = ny; }
    if (sim.target || sim.auto) { sim.target = null; sim.path = []; sim.auto = null; emit(sim, "log", "Manual control.", "info"); }
  }
  sim.manual = manual;
  if (sim.target) {
    const wp = sim.path[0] || sim.target;
    if (sim.path.length && dist(b, wp) < 6) sim.path.shift();
    const want = Math.atan2(wp.y - b.y, wp.x - b.x);
    const diff = ((want - b.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    b.a += Math.max(-0.1, Math.min(0.1, diff));
    const sp = isTight(sim, b.x, b.y) ? 1.1 : 2.3;
    if (Math.abs(diff) < 0.7) {
      const nx = b.x + Math.cos(b.a) * sp, ny = b.y + Math.sin(b.a) * sp;
      if (!isBlocked(sim, nx, ny)) { b.x = nx; b.y = ny; }
      else if (!isBlocked(sim, b.x + Math.cos(b.a) * sp, b.y)) b.x += Math.cos(b.a) * sp;
      else if (!isBlocked(sim, b.x, b.y + Math.sin(b.a) * sp)) b.y += Math.sin(b.a) * sp;
    }
    sim.battery = Math.max(1, sim.battery - 0.004);
    if (dist(b, sim.target) <= sim.target.stop) { const t = sim.target; sim.target = null; sim.path = []; if (t.label === "base") arrivedBase(sim); }
  }
  const tight = isTight(sim, b.x, b.y);
  b.squeeze += ((tight ? 1 : 0) - b.squeeze) * 0.16;
  if (sim.frame % 5 === 0) { const l = sim.trail[sim.trail.length - 1]; if (!l || dist(l, b) > 8) { sim.trail.push({ x: b.x, y: b.y }); if (sim.trail.length > 220) sim.trail.shift(); } }
  if (tight && !sim.squeezed && sim.target) { sim.squeezed = true; if (sim.frame - (sim.lastSqueezeMsg || -999) > 300) { sim.lastSqueezeMsg = sim.frame; emit(sim, "log", "Bob is squeezing through a tight gap.", "info", { banner: "SQUEEZING IN" }); } }
  if (!tight) sim.squeezed = false;
  detect(sim, b, BOB_SENSE * (sim.def.hazards === "smoke" ? 0.7 : 1), "bob");
  for (const s of sim.survivors) {
    if (s.reached) continue;
    if (sim.def.tapping && s.state === "unknown" && !s.tapped && dist(b, s) < 190) {
      s.tapped = true; emit(sim, "log", "Bob hears tapping from beyond the rubble.", "info", { banner: "TAPPING HEARD" });
    }
    if (dist(b, s) < REACH) {
      s.reached = true; s.state = "reached"; sim.lastReach = sim.frame;
      emit(sim, "reached", "Bob reached the survivor " + s.note + ". " + (s.id % 2 ? "Breathing, responsive." : "Conscious and calling out."), "ok", { survivor: s, banner: "SURVIVOR REACHED" });
      if (sim.target && sim.target.label === "signal") { sim.target = null; sim.path = []; }
    }
  }
}

function arrivedBase(sim) {
  const n = sim.survivors.filter((s) => s.reached).length;
  sim.finished = { frames: sim.frame, located: sim.lastReach || sim.frame, found: n, total: sim.survivors.length, aided: sim.survivors.filter((s) => s.aided).length, battery: Math.round(sim.battery), pip: sim.pipOn };
  emit(sim, "done", "Bob is back at base with " + n + " of " + sim.survivors.length + " survivors located.", "ok", { banner: "MISSION COMPLETE" });
}

export function runAuto(sim) {
  sim.auto = { phase: "go", hold: 40 };
  emit(sim, "log", "Scenario started. Bob is working on his own.", "info");
}

function stepAuto(sim) {
  const a = sim.auto;
  if (a.hold > 0) { a.hold--; return; }
  const all = sim.survivors.every((s) => s.reached);
  for (const s of sim.survivors) if (s.reached && !s.aided) requestAid(sim, s);
  if (sim.target) return;
  if (a.phase === "go") {
    if (sim.pipOn && !sim.pip && !a.launched) { a.launched = true; launchPip(sim); a.hold = 30; return; }
    const s = nextSignal(sim);
    if (s) { emit(sim, "log", "Bob is heading to the heat signature " + s.note + ".", "info"); goTo(sim, s, REACH - 4, "signal"); return; }
    if (all) { a.phase = "wait"; return; }
    const pipBusy = sim.pip && sim.pip.state !== "back" && !sim.def.flyMaxX;
    if (pipBusy && sim.frame < 3000) return;
    let spot = nextUnexplored(sim);
    while (spot && !goTo(sim, spot, 10, "explore")) { sim.cover[spot.i] = 1; sim.events.pop(); spot = nextUnexplored(sim); }
    if (!spot) a.phase = "wait";
  } else if (a.phase === "wait") {
    const aidPending = sim.pip && (sim.pip.aid.length > 0 || sim.pip.state === "out");
    if (sim.pip && sim.pip.state === "out" && !sim.pip.aid.length) recallPip(sim);
    if (aidPending || (sim.pip && sim.pip.state === "back")) return;
    a.phase = "home"; a.hold = 30;
    emit(sim, "log", "All survivors located. Bob is heading home.", "info");
  } else if (a.phase === "home") {
    sim.auto = null;
    goTo(sim, sim.def.base, 12, "base");
  }
}

export function step(sim, keys) {
  sim.frame++;
  if (sim.auto) stepAuto(sim);
  stepBob(sim, keys);
  if (sim.pip) stepPip(sim);
}

export function drainEvents(sim) {
  const e = sim.events; sim.events = []; return e;
}

export function summary(sim) {
  return sim.finished;
}
