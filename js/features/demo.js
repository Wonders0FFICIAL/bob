import { $, el, pad } from "../dom.js";
import { S } from "../state.js";
import { setStatus } from "../ui.js";
import { claim, endActive } from "../control.js";
import { drawStanding, drawLying, LOOKS } from "./person.js";
import { store, KEYS } from "../storage.js";
import { actionFor, driveKeyFor, HELP } from "./demo-keys.js";
import { DEFAULT_PALETTE, nextPalette, paletteById } from "./thermal.js";

export function initDemo() {
  const { feed, rtc, ph } = el;
  const cv = $("demo"), btn = $("demobtn"), panel = $("demopanel"), logEl = $("demolog");
  const ctx = cv.getContext("2d");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 640, H = 480, RANGE = 190;
  const fullBtn = $("demofull");
  let scale = 1, t0 = 0;
  const BASE = { x: 70, y: 410 };
  const RUBBLE = [[200, 300, 26], [300, 160, 32], [460, 330, 22], [150, 150, 20], [540, 200, 28], [380, 420, 18]];

  let on = false, raf = 0, frame = 0;
  let bob, target, onArrive, ents, keys, trail, battery, path = [], pip = null, pipLeft = 3, pings = [];
  const PIP_RANGE = 95;
  const INSET_SIZE = { w: 208, h: 156 };
  const INSET_SPOTS = [{ x: W - 208 - 12, y: H - 28 - 156 - 12 }, { x: W - 208 - 12, y: 46 }, { x: 12, y: 46 }];
  const ZOOM = { min: 1.4, max: 4, step: 0.3 };
  const CARDINAL = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const pipBtn = panel.querySelector('[data-cmd="pip"]');
  const holdBtn = panel.querySelector('[data-cmd="piphold"]');
  const insetBtn = panel.querySelector('[data-cmd="inset"]');
  const paletteBtn = panel.querySelector('[data-cmd="palette"]');
  const pipStateEl = panel.querySelector("[data-pip-state]");
  const viewBtns = [...panel.querySelectorAll("[data-view]")];
  const labelOf = (btn) => btn.querySelector(".label");
  let pipHold = store.read(KEYS.pipHold) === "1";
  let insetOn = store.read(KEYS.inset) !== "0";
  let palette = paletteById(store.read(KEYS.palette) || DEFAULT_PALETTE);
  let zoom = 2.3, help = false, lastPipState = "";

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const elapsed = () => { const s = Math.floor((performance.now() - t0) / 1000); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
  function fit() {
    const w = cv.clientWidth;
    if (!w) return;
    const want = Math.min(3, Math.max(1, Math.ceil(w * (window.devicePixelRatio || 1) / W)));
    if (want === scale && cv.width === W * want) return;
    scale = want;
    cv.width = W * scale;
    cv.height = H * scale;
  }
  const stamp = () => { const d = new Date(); return pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };

  function log(text, kind) {
    const li = document.createElement("li");
    if (kind) li.className = kind;
    li.innerHTML = "<b>" + stamp() + "</b>";
    li.append(text);
    logEl.prepend(li);
    while (logEl.children.length > 6) logEl.lastChild.remove();
  }

  const CELL = 20, COLS = W / CELL, ROWS = H / CELL, PAD = 22;
  const blocked = (x, y, pad = PAD) => RUBBLE.some(([rx, ry, r]) => Math.hypot(x - rx, y - ry) < r + pad);

  function clear(a, b) {
    const n = Math.ceil(dist(a, b) / 6);
    for (let i = 1; i <= n; i++) {
      if (blocked(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    }
    return true;
  }

  function findPath(from, to) {
    const cell = (p) => ({ c: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL))), r: Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL))) });
    const id = (c, r) => r * COLS + c;
    const centre = (i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
    const s0 = cell(from), g0 = cell(to), start = id(s0.c, s0.r), goal = id(g0.c, g0.r);
    const g = { [start]: 0 }, parent = {}, open = [start], done = new Set();
    const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked(c * CELL + CELL / 2, r * CELL + CELL / 2);

    while (open.length) {
      let k = 0;
      for (let i = 1; i < open.length; i++) {
        const f = (n) => g[n] + dist(centre(n), centre(goal));
        if (f(open[i]) < f(open[k])) k = i;
      }
      const cur = open.splice(k, 1)[0];
      if (cur === goal) break;
      done.add(cur);
      const cc = cur % COLS, cr = Math.floor(cur / COLS);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        const nc = cc + dc, nr = cr + dr, n = id(nc, nr);
        if (done.has(n) || !free(nc, nr)) continue;
        if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue;
        const ng = g[cur] + (dc && dr ? 1.414 : 1);
        if (g[n] === undefined || ng < g[n]) { g[n] = ng; parent[n] = cur; if (!open.includes(n)) open.push(n); }
      }
    }
    if (g[goal] === undefined) return null;

    const pts = [];
    for (let n = goal; n !== start; n = parent[n]) pts.unshift(centre(n));
    pts[pts.length - 1] = { x: to.x, y: to.y };
    const out = [];
    let cur = from, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clear(cur, pts[j])) j--;
      out.push(pts[j]); cur = pts[j]; i = j + 1;
    }
    return out;
  }

  function place() {
    for (let i = 0; i < 80; i++) {
      const p = { x: 90 + Math.random() * (W - 180), y: 70 + Math.random() * (H - 190) };
      if (dist(p, bob) > 250 && !blocked(p.x, p.y, 45)) return p;
    }
    return { x: 540, y: 120 };
  }

  function placeNear(o) {
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * 6.283, d = 60 + Math.random() * 30;
      const p = { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d };
      if (p.x > 40 && p.x < W - 40 && p.y > 40 && p.y < H - 70 && !blocked(p.x, p.y, 35)) return p;
    }
    return { x: o.x + 60, y: o.y };
  }

  function goto(p, stop, cb) {
    const route = findPath(bob, p);
    if (!route) { log("No safe route found.", "alert"); return false; }
    target = { x: p.x, y: p.y, stop }; onArrive = cb; path = route;
    return true;
  }

  function reset() {
    bob = { x: BASE.x, y: BASE.y, a: -0.8 };
    target = onArrive = null; path = [];
    ents = []; keys = {}; trail = []; battery = 100; t0 = performance.now();
    pip = null; pipLeft = 3; pings = []; banners = [];
    logEl.innerHTML = "";
    log("Bob online at base. Awaiting orders.");
    if (pipHold) launchPip();
    syncPipUi();
  }

  const COMMANDS = {
    fire() {
      const p = place();
      ents = ents.filter((x) => x.type !== "fire" && x.type !== "person" && x.type !== "packet");
      ents.push({ type: "fire", x: p.x, y: p.y, found: false });
      log("ALERT: fire reported in the " + (p.x > W / 2 ? "east" : "west") + " wing.", "alert");
      log("Dispatching Bob. Route planned around the rubble.");
      goto(p, 45, () => {
        log("Fire confirmed at " + Math.round(temp()) + "°C. Photo added to report.", "alert");
        setTimeout(() => on && !target && log("Report sent to the rescue team. Bob holding position.", "ok"), 1500);
      });
    },
    survivor() {
      const fire = ents.find((x) => x.type === "fire");
      const p = fire ? placeNear(fire) : place();
      ents = ents.filter((x) => x.type !== "person");
      ents.push({ type: "person", x: p.x, y: p.y, found: false });
      log(fire ? "Search started around the fire area." : "Search started. Scanning for heat signatures.");
      goto(p, 40, () => log("Person found and responsive. Location sent to the crew.", "ok"));
    },
    base() {
      log("Returning to base.");
      goto(BASE, 14, () => {
        const saved = ents.some((x) => x.type === "person" && x.found);
        if (saved) banner("MISSION COMPLETE", "ok");
        log(saved ? "Mission complete in " + elapsed() + ". Person located, Bob docked with " + Math.round(battery) + "% battery." : "Bob docked. Battery " + Math.round(battery) + "%.", "ok");
      });
    },
    pip() {
      if (!pip) { launchPip(); return; }
      if (pipHold) setHold(false);
      else if (pip.state !== "back") { pip.state = "back"; log("Pip recalled."); }
    },
    piphold() { setHold(!pipHold); },
    inset() { setInset(!insetOn); },
    swap() { setView(insetSource()); },
    palette() { setPalette(nextPalette(palette.id)); },
    help() { help = !help; },
    closehelp() { help = false; },
    cycleview() { setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]); },
    viewmap() { setView("map"); },
    viewbob() { setView("bob"); },
    viewpip() { setView("pip"); },
    zoomin() { setZoom(zoom + ZOOM.step); },
    zoomout() { setZoom(zoom - ZOOM.step); },
    full() { $("full").click(); },
    stop() {
      target = onArrive = null; path = [];
      log("Stopped. Holding position.");
    },
    reset() {
      reset();
    },
  };

  function pipTarget() {
    const byDist = (a, b) => dist(bob, a) - dist(bob, b);
    const open = ents.filter((x) => !x.found && x.type !== "packet").sort(byDist)[0]
      || (pipLeft > 0 ? ents.filter((x) => x.type === "person" && x.found && !x.aided).sort(byDist)[0] : null);
    return open ? { x: open.x, y: open.y } : null;
  }

  function launchPip() {
    const goal = pipTarget();
    pip = { x: bob.x, y: bob.y, goal: goal || place(), state: goal || !pipHold ? "out" : "escort", hold: 0, bat: 100, orbit: 0 };
    syncPipUi();
    log("Pip launched from Bob's hangar." + (pipHold ? " It stays out and follows Bob." : " Flying over the rubble. Press V for Pip's view."));
  }

  function setHold(on) {
    pipHold = on;
    store.write(KEYS.pipHold, on ? "1" : "0");
    if (on && !pip) launchPip();
    else if (on) {
      pip.bat = 100;
      if (pip.state === "back") pip.state = "escort";
      log("Pip stays out and follows Bob. Demo only: its battery is held at full.");
    } else if (pip && pip.state !== "back") {
      pip.state = "back";
      log("Pip recalled.");
    }
    syncPipUi();
  }

  function setInset(on) {
    insetOn = on;
    store.write(KEYS.inset, on ? "1" : "0");
    paintPrefs();
  }

  function setPalette(next) {
    palette = next;
    store.write(KEYS.palette, next.id);
    paintPrefs();
  }

  function setZoom(value) {
    zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, Math.round(value * 10) / 10));
  }

  function paintPrefs() {
    holdBtn.setAttribute("aria-checked", String(pipHold));
    insetBtn.setAttribute("aria-checked", String(insetOn));
    labelOf(paletteBtn).textContent = "Thermal: " + palette.label;
  }

  function pipStateText() {
    if (!pip) return "Docked";
    return { out: "Flying out", scout: "Scanning", back: "Returning", escort: "Escorting" }[pip.state];
  }

  function syncPipUi() {
    labelOf(pipBtn).textContent = pip ? "Recall Pip" : "Launch Pip";
    pipBtn.setAttribute("aria-pressed", String(!!pip));
    paintPrefs();
    lastPipState = pipStateText();
    pipStateEl.textContent = lastPipState;
    pipStateEl.dataset.state = pip ? pip.state : "docked";
  }

  function detect(src, range, who) {
    for (const e of ents) {
      if (e.type === "packet" || e.found || dist(src, e) >= range) continue;
      e.found = true;
      const fire = ents.some((x) => x.type === "fire");
      if (e.type === "fire") {
        log(who ? "Pip discovered the fire. Thermal hotspot confirmed." : "Fire discovered. Thermal hotspot detected ahead.", "alert");
        banner("FIRE DISCOVERED", "alert");
      } else {
        log((who ? "Pip found a survivor" : "Survivor found") + (fire ? " near the fire." : "."), "ok");
        banner("SURVIVOR FOUND", "ok");
      }
    }
  }

  function stepPip() {
    const p = pip;
    p.orbit += 0.06;
    if (!pipHold) p.bat = Math.max(0, p.bat - 0.04);
    if (!pipHold && p.bat < 25 && p.state !== "back") { p.state = "back"; log("Pip battery low. Coming back to Bob.", "alert"); }
    let goal = p.goal;
    if (p.state === "back") goal = bob;
    else if (p.state === "scout") goal = { x: p.goal.x + Math.cos(p.orbit) * 34, y: p.goal.y + Math.sin(p.orbit) * 34 };
    else if (p.state === "escort") {
      goal = {
        x: Math.max(16, Math.min(W - 16, bob.x + Math.cos(bob.a) * 64 + Math.cos(p.orbit * 0.5) * 26)),
        y: Math.max(16, Math.min(H - 44, bob.y + Math.sin(bob.a) * 64 + Math.sin(p.orbit * 0.5) * 26)),
      };
    }
    const d = dist(p, goal), v = p.state === "scout" ? 2.4 : p.state === "escort" ? Math.min(4.2, 1.2 + dist(p, goal) * 0.08) : 3.4;
    if (d > 1) { const m = Math.min(v, d); p.x += (goal.x - p.x) / d * m; p.y += (goal.y - p.y) / d * m; }
    detect(p, PIP_RANGE, "Pip: ");
    if (p.state === "escort" && frame % 30 === 0) {
      const next = pipTarget();
      if (next) { p.goal = next; p.state = "out"; log("Pip is leaving Bob's side to check a new target."); }
    }
    if (p.state === "out" && dist(p, p.goal) < 12) {
      p.state = "scout"; p.hold = calm ? 60 : 200;
      log("Pip is over the area and scanning with its thermal camera.");
    } else if (p.state === "scout" && --p.hold <= 0) {
      const person = ents.find((x) => x.type === "person" && x.found && dist(x, p) < PIP_RANGE + 20 && !x.aided);
      if (person && pipLeft > 0) {
        person.aided = true; pipLeft--;
        ents.push({ type: "packet", x: person.x + 16, y: person.y + 14, born: frame });
        log("Aid dropped: Pip placed a first-aid packet beside the survivor (" + pipLeft + " left).", "ok");
        banner("AID DROPPED", "aid");
      } else if (!ents.some((x) => x.found && dist(x, p) < PIP_RANGE + 20)) {
        log("Pip scanned the area and found nothing.");
      }
      p.state = pipHold ? "escort" : "back";
    } else if (p.state === "back" && dist(p, bob) < 14) {
      log("Pip docked in Bob's hangar. Battery " + Math.round(p.bat) + "%.", "ok");
      pip = null; pipLeft = 3; syncPipUi();
    }
  }

  function temp() {
    let t = 24;
    for (const e of ents) {
      if (e.type !== "fire") continue;
      const d = dist(bob, e);
      if (d < 220) t = Math.max(t, 24 + 380 * (1 - d / 220));
    }
    return t;
  }

  function step() {
    const boost = keys.Shift ? 1.6 : 1, turn = 0.05, speed = 2.2 * boost;
    let manual = false;
    if (keys.ArrowLeft)  { bob.a -= turn; manual = true; }
    if (keys.ArrowRight) { bob.a += turn; manual = true; }
    if (keys.ArrowUp)    { bob.x += Math.cos(bob.a) * speed; bob.y += Math.sin(bob.a) * speed; manual = true; }
    if (keys.ArrowDown)  { bob.x -= Math.cos(bob.a) * 1.5 * boost; bob.y -= Math.sin(bob.a) * 1.5 * boost;   manual = true; }
    if (manual && target) { target = onArrive = null; path = []; log("Manual control."); }

    if (target) {
      const wp = path[0] || target;
      if (path.length && dist(bob, wp) < 10) path.shift();
      const want = Math.atan2(wp.y - bob.y, wp.x - bob.x);
      let diff = ((want - bob.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      bob.a += Math.max(-0.06, Math.min(0.06, diff));
      if (Math.abs(diff) < 0.5) { bob.x += Math.cos(bob.a) * speed; bob.y += Math.sin(bob.a) * speed; }
      if (dist(bob, target) <= target.stop) {
        const cb = onArrive; target = onArrive = null; path = [];
        if (cb) cb();
      }
    }

    for (const [rx, ry, r] of RUBBLE) {
      const d = dist(bob, { x: rx, y: ry }), min = r + 10;
      if (d < min) { bob.x = rx + (bob.x - rx) / d * min; bob.y = ry + (bob.y - ry) / d * min; }
    }
    bob.x = Math.max(20, Math.min(W - 20, bob.x));
    bob.y = Math.max(20, Math.min(H - 40, bob.y));
    if (frame % 6 === 0) {
      const last = trail[trail.length - 1];
      if (!last || dist(last, bob) > 6) { trail.push({ x: bob.x, y: bob.y }); if (trail.length > 140) trail.shift(); }
    }
    if (target || manual) battery = Math.max(1, battery - 0.01 * boost);

    detect(bob, RANGE * 0.8, "");
    if (pip) stepPip();
  }

  const SPECKS = [];
  for (let i = 0, r = 7; i < 140; i++) {
    r = (r * 9301 + 49297) % 233280; const x = r / 233280 * W;
    r = (r * 9301 + 49297) % 233280; const y = r / 233280 * H;
    r = (r * 9301 + 49297) % 233280; SPECKS.push([x, y, 0.6 + r / 233280 * 1.4]);
  }
  const VIEWS = ["map", "bob", "pip"];
  const VIEW_NAME = { map: "MAP VIEW", bob: "BOB CAM", pip: "PIP THERMAL" };
  const VIEW_SHORT = { map: "MAP", bob: "BOB", pip: "PIP" };
  let view = "map", banners = [];

  function banner(text, kind) { banners.push({ text, kind, born: frame }); if (banners.length > 3) banners.shift(); }

  function setView(v) {
    view = VIEWS.includes(v) ? v : "map";
    for (const b of viewBtns) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  }

  function insetRect() {
    const covers = (spot, o) => o.x > spot.x - 24 && o.x < spot.x + INSET_SIZE.w + 24 && o.y > spot.y - 24 && o.y < spot.y + INSET_SIZE.h + 24;
    const spot = view === "map" ? INSET_SPOTS.find((c) => !covers(c, bob) && !(pip && covers(c, pip))) || INSET_SPOTS[0] : INSET_SPOTS[0];
    return { ...spot, ...INSET_SIZE };
  }

  function insetSource() {
    if (view === "map") return pip ? "pip" : "bob";
    return "map";
  }

  function tag(x, y, text, bg, fg, size) {
    ctx.font = "bold " + size + "px sans-serif";
    pill(x + (ctx.measureText(text).width + 14) / 2, y, text, bg, fg, size);
  }

  function pill(x, y, text, bg, fg, size) {
    ctx.font = "bold " + (size || 11) + "px sans-serif";
    const w = ctx.measureText(text).width + 14, h = (size || 11) + 9;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5);
    ctx.textBaseline = "alphabetic";
  }

  function flame(x, y, h, w, ph) {
    const sway = calm ? 0 : Math.sin(frame / 6 + ph) * w * 0.25, hh = h * (1 + (calm ? 0 : Math.sin(frame / 4 + ph) * 0.12));
    const g = ctx.createLinearGradient(0, y, 0, y - hh);
    g.addColorStop(0, "#E5322D"); g.addColorStop(0.45, "#FF8A1F"); g.addColorStop(1, "rgba(255,228,120,.9)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 1.1, y - hh * 0.5, x + sway, y - hh);
    ctx.quadraticCurveTo(x + w * 1.1, y - hh * 0.5, x + w, y);
    ctx.closePath(); ctx.fill();
  }

  function figure(x, y, s) { drawStanding(ctx, x, y, s, frame, LOOKS[0], calm); }

  function heat() { return Math.min(1, (temp() - 24) / 300); }

  function rubbleShape(x, y, r, i, c1, c2, sx, sy) {
    ctx.fillStyle = c1; ctx.strokeStyle = c2; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.283, rr = r * (0.75 + 0.25 * Math.sin(k * 2.7 + x));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawMap(t) {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 420);
    bg.addColorStop(0, "#0C1A24"); bg.addColorStop(1, "#04090D");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(160,190,210,.07)";
    for (const [x, y, r] of SPECKS) ctx.fillRect(x, y, r, r);
    ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    RUBBLE.forEach(([x, y, r], i) => {
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x + 4, y + 6, r * 1.05, r * 0.9, 0, 0, 7); ctx.fill();
      rubbleShape(x, y, r, i, "#17262F", "#34505F");
      ctx.fillStyle = "rgba(120,160,180,.14)"; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.35, 0, 7); ctx.fill();
    });

    ctx.strokeStyle = "#8EA3B2"; ctx.lineWidth = 2;
    const bx = BASE.x, by = BASE.y;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath(); ctx.moveTo(bx + sx * 20, by + sy * 8); ctx.lineTo(bx + sx * 20, by + sy * 20); ctx.lineTo(bx + sx * 8, by + sy * 20); ctx.stroke();
    }
    ctx.fillStyle = "rgba(142,163,178,.12)"; ctx.fillRect(bx - 18, by - 18, 36, 36);
    pill(bx, by + 34, "BASE", "rgba(142,163,178,.22)", "#C9D6DF", 10);

    if (trail.length > 1) {
      ctx.strokeStyle = "rgba(255,210,31,.28)"; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath();
      trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (target && path.length) {
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(bob.x, bob.y);
      path.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
    }

    pings = pings.filter((q) => frame - q.born < 50);
    for (const q of pings) {
      const u = (frame - q.born) / 50;
      ctx.strokeStyle = "rgba(255,210,31," + (1 - u) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, 6 + u * 22, 0, 7); ctx.stroke();
    }
    if (target && path.length) {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(target.x, target.y - 6); ctx.lineTo(target.x + 6, target.y); ctx.lineTo(target.x, target.y + 6); ctx.lineTo(target.x - 6, target.y); ctx.closePath(); ctx.stroke();
    }

    for (const e of ents) {
      if (e.type === "packet") {
        const k = Math.min(1, (frame - e.born) / 28), lift = (1 - k) * (1 - k) * 34;
        ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, 7, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#FF7A1F"; ctx.strokeStyle = "#0D1C26"; ctx.lineWidth = 1.5;
        ctx.fillRect(e.x - 6, e.y - 6 - lift, 12, 12); ctx.strokeRect(e.x - 6, e.y - 6 - lift, 12, 12);
        ctx.fillStyle = "#fff"; ctx.fillRect(e.x - 1, e.y - 4 - lift, 2, 8); ctx.fillRect(e.x - 4, e.y - 1 - lift, 8, 2);
        if (k >= 1) pill(e.x, e.y + 20, "AID", "rgba(255,122,31,.9)", "#1A0F06", 10);
      } else if (e.type === "fire") {
        if (!e.found) {
          ctx.strokeStyle = "rgba(229,50,45,.7)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath();
          ctx.arc(e.x, e.y, 24, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          pill(e.x, e.y + 40, "REPORTED", "rgba(229,50,45,.28)", "#FFB3AD", 10);
        } else {
          const r = 26 + (calm ? 0 : Math.sin(t / 5 + e.x) * 4);
          for (let k = 0; k < 4 && !calm; k++) {
            const u = ((t + k * 22) % 88) / 88;
            ctx.fillStyle = "rgba(120,120,125," + (0.22 * (1 - u)) + ")";
            ctx.beginPath(); ctx.arc(e.x + Math.sin(k * 2 + u * 3) * 10, e.y - 8 - u * 46, 8 + u * 14, 0, 7); ctx.fill();
          }
          const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, r + 12);
          g.addColorStop(0, "#FFE066"); g.addColorStop(0.45, "#FF7A1F"); g.addColorStop(1, "rgba(229,50,45,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r + 12, 0, 7); ctx.fill();
          pill(e.x, e.y + 44, "FIRE", "#E5322D", "#fff", 10);
        }
      } else if (e.found) {
        const pr = 12 + (calm ? 0 : (t % 60) / 3);
        ctx.strokeStyle = "rgba(30,158,90," + (calm ? 0.6 : 1 - (t % 60) / 60) + ")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, pr, 0, 7); ctx.stroke();
        drawLying(ctx, e.x, e.y, 0.7, 0.5, LOOKS[0], frame, calm);
        pill(e.x, e.y + 28, e.aided ? "SURVIVOR · AID SENT" : "SURVIVOR", "#1E9E5A", "#fff", 10);
      }
    }

    ctx.strokeStyle = "rgba(255,210,31,.14)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(bob.x, bob.y, RANGE * i / 3, 0, 7); ctx.stroke(); }
    if (ctx.createConicGradient) {
      const sw = calm ? bob.a : t * 0.045;
      const g = ctx.createConicGradient(sw - 0.9, bob.x, bob.y);
      g.addColorStop(0, "rgba(255,210,31,0)"); g.addColorStop(0.14, "rgba(255,210,31,.3)"); g.addColorStop(0.1401, "rgba(255,210,31,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bob.x, bob.y, RANGE, 0, 7); ctx.fill();
    }

    ctx.save(); ctx.translate(bob.x, bob.y); ctx.rotate(bob.a);
    const lg = ctx.createLinearGradient(10, 0, 78, 0); lg.addColorStop(0, "rgba(255,248,220,.28)"); lg.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(78, -30); ctx.lineTo(78, 30); ctx.lineTo(10, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0A0F12";
    for (const [wx, wy] of [[-9, -11], [7, -11], [-9, 8], [7, 8]]) ctx.fillRect(wx, wy, 9, 4);
    ctx.fillStyle = "#30363B"; ctx.strokeStyle = "#FF5A14"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-14, -8, 28, 16, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#FFD21F"; ctx.beginPath(); ctx.arc(10, 0, 3, 0, 7); ctx.fill();
    ctx.fillStyle = pip ? "#1B2328" : "#59D2FF"; ctx.fillRect(-9, -4, 10, 8);
    ctx.restore();

    if (pip && pipHold) {
      ctx.strokeStyle = "rgba(89,210,255,.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(bob.x, bob.y); ctx.lineTo(pip.x, pip.y); ctx.stroke(); ctx.setLineDash([]);
    }
    if (pip) drawPip(pip.x, pip.y, 1, t);
  }

  function drawPip(x, y, z, t, ring = true) {
    if (ring) {
      ctx.strokeStyle = "rgba(89,210,255,.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(x, y, PIP_RANGE * z, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x + 6 * z, y + 10 * z, 11 * z, 5 * z, 0, 0, 7); ctx.fill();
    const spin = calm ? 0 : t * 0.9;
    for (let k = 0; k < 4; k++) {
      const ax = x + (k % 2 ? 9 : -9) * z, ay = y + (k < 2 ? -9 : 9) * z;
      ctx.strokeStyle = "#FF5A14"; ctx.lineWidth = 2.5 * z; ctx.beginPath(); ctx.arc(ax, ay, 7 * z, 0, 7); ctx.stroke();
      ctx.strokeStyle = "rgba(230,237,242,.85)"; ctx.lineWidth = 1.5 * z;
      ctx.beginPath(); ctx.moveTo(ax + Math.cos(spin + k) * 6 * z, ay + Math.sin(spin + k) * 6 * z); ctx.lineTo(ax - Math.cos(spin + k) * 6 * z, ay - Math.sin(spin + k) * 6 * z); ctx.stroke();
    }
    ctx.fillStyle = "#59D2FF"; ctx.strokeStyle = "#0D1C26"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5 * z, 0, 7); ctx.fill(); ctx.stroke();
    if (z === 1) pill(x, y - 24, pipHold ? "PIP \u00B7 HOLD" : "PIP", "rgba(89,210,255,.85)", "#06232E", 10);
  }

  function project(x, y) {
    const dx = x - bob.x, dy = y - bob.y, c = Math.cos(bob.a), s = Math.sin(bob.a);
    const fwd = dx * c + dy * s, right = -dx * s + dy * c;
    return { fwd, sx: W / 2 + 380 * right / Math.max(fwd, 0.001), k: 380 / Math.max(fwd, 0.001) };
  }

  const metres = (o) => (dist(bob, o) / 100).toFixed(1) + " m";
  const headingDeg = () => Math.round(((bob.a * 180 / Math.PI + 90) % 360 + 360) % 360);

  function drawTape() {
    const hdg = headingDeg();
    ctx.save();
    ctx.fillStyle = "rgba(5,11,16,.55)"; ctx.fillRect(W / 2 - 150, 40, 300, 22);
    ctx.strokeStyle = "rgba(230,237,242,.75)"; ctx.fillStyle = "#E6EDF2"; ctx.lineWidth = 1; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
    for (let d = Math.ceil((hdg - 40) / 5) * 5; d <= hdg + 40; d += 5) {
      const x = W / 2 + (d - hdg) * 3.75, deg = ((d % 360) + 360) % 360;
      ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x, deg % 15 === 0 ? 52 : 57); ctx.stroke();
      if (deg % 45 === 0) ctx.fillText(CARDINAL[deg / 45], x, 49);
    }
    ctx.fillStyle = "#FFD21F"; ctx.beginPath(); ctx.moveTo(W / 2 - 5, 36); ctx.lineTo(W / 2 + 5, 36); ctx.lineTo(W / 2, 42); ctx.fill();
    ctx.restore();
  }

  function clearance() {
    const c = Math.cos(bob.a), s = Math.sin(bob.a);
    let best = Infinity;
    for (const [x, y, r] of RUBBLE) {
      const dx = x - bob.x, dy = y - bob.y, fwd = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
      if (fwd > 0 && side < r + 14) best = Math.min(best, Math.hypot(dx, dy) - r - 10);
    }
    return best === Infinity ? null : Math.max(0, best);
  }

  function drawRange() {
    const gap = clearance();
    if (gap === null || gap > 300) return;
    const close = gap < 35;
    pill(W / 2, H - 50, (close ? "OBSTACLE " : "RANGE ") + (gap / 100).toFixed(1) + " m", close ? "#E5322D" : "rgba(5,11,16,.72)", "#fff", 11);
  }

  function drawGround(t) {
    const hz = 190, camH = 15;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#080F14"); sky.addColorStop(1, "#1A2A34");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    const hf = heat();
    for (let sx = 0; sx < W; sx += 10) {
      const ang = bob.a + Math.atan((sx + 5 - W / 2) / 380);
      const hsh = Math.abs(Math.sin(Math.floor(ang * 9) * 12.9898) * 43758.5453) % 1;
      const h = 14 + hsh * 62, top = hz - h;
      ctx.fillStyle = "rgb(" + (14 + hsh * 8 + hf * 30 | 0) + "," + (24 + hsh * 8) + "," + (31 + hsh * 8) + ")";
      ctx.fillRect(sx, top, 10, h);
      if (hsh > 0.72) { ctx.fillStyle = "rgba(255,190,90," + (0.1 + hf * 0.25) + ")"; ctx.fillRect(sx + 3, top + 8, 4, 5); }
    }
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, "#1A262E"); fl.addColorStop(1, "#0B1217");
    ctx.fillStyle = fl; ctx.fillRect(0, hz, W, H - hz);
    const fog = ctx.createLinearGradient(0, hz - 6, 0, hz + 70);
    fog.addColorStop(0, "rgba(40,62,76,.55)"); fog.addColorStop(1, "rgba(40,62,76,0)");
    ctx.fillStyle = fog; ctx.fillRect(0, hz - 6, W, 76);
    const pool = ctx.createRadialGradient(W / 2, hz + 120, 8, W / 2, hz + 120, 200);
    pool.addColorStop(0, "rgba(255,244,214,.16)"); pool.addColorStop(1, "rgba(255,244,214,0)");
    ctx.fillStyle = pool; ctx.fillRect(0, hz, W, H - hz);

    ctx.lineWidth = 1;
    const c = Math.cos(bob.a), s = Math.sin(bob.a), GR = 60;
    const gx0 = Math.floor((bob.x - 460) / GR) * GR, gy0 = Math.floor((bob.y - 460) / GR) * GR;
    for (let pass = 0; pass < 2; pass++) {
      for (let g = 0; g <= 16; g++) {
        const fixed = (pass ? gy0 : gx0) + g * GR;
        ctx.beginPath(); let pen = false;
        for (let u = 0; u <= 32; u++) {
          const o = (pass ? gx0 : gy0) + u * (GR * 16 / 32);
          const p = pass ? project(o, fixed) : project(fixed, o);
          if (p.fwd < 14) { pen = false; continue; }
          const sy = hz + camH * p.k;
          if (pen) ctx.lineTo(p.sx, sy); else ctx.moveTo(p.sx, sy);
          pen = true;
        }
        const fade = 0.08;
        ctx.strokeStyle = "rgba(150,185,205," + fade + ")"; ctx.stroke();
      }
    }

    const items = [];
    RUBBLE.forEach(([x, y, r], i) => { const p = project(x, y); if (p.fwd > 10) items.push({ k: "r", p, r, i }); });
    for (const e of ents) {
      const known = e.type === "packet" || e.found;
      if (!known) continue;
      const p = project(e.x, e.y); if (p.fwd > 10) items.push({ k: e.type, p, e });
    }
    if (pip) { const p = project(pip.x, pip.y); if (p.fwd > 10) items.push({ k: "pip", p }); }
    items.sort((a, b) => b.p.fwd - a.p.fwd);

    for (const it of items) {
      const { p } = it, sc = p.k, gy = hz + camH * sc;
      if (p.sx < -140 || p.sx > W + 140) continue;
      if (it.k === "r") {
        const w = it.r * 1.5 * sc, h = it.r * 0.95 * sc;
        const g = ctx.createLinearGradient(0, gy - h, 0, gy);
        g.addColorStop(0, "#3A4E5A"); g.addColorStop(1, "#141E25");
        ctx.fillStyle = g; ctx.strokeStyle = "#4B6675"; ctx.lineWidth = Math.max(1, sc * 1.2);
        ctx.beginPath(); ctx.moveTo(p.sx - w, gy);
        ctx.lineTo(p.sx - w * 0.7, gy - h * 0.55); ctx.lineTo(p.sx - w * 0.25, gy - h); ctx.lineTo(p.sx + w * 0.15, gy - h * 0.8);
        ctx.lineTo(p.sx + w * 0.6, gy - h * 0.5); ctx.lineTo(p.sx + w, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(10,16,20,.6)"; ctx.beginPath(); ctx.moveTo(p.sx - w * 0.25, gy - h); ctx.lineTo(p.sx - w * 0.1, gy - h * 0.2); ctx.moveTo(p.sx + w * 0.3, gy - h * 0.65); ctx.lineTo(p.sx + w * 0.2, gy); ctx.stroke();
      } else if (it.k === "fire") {
        const R = 34 * sc;
        const g = ctx.createRadialGradient(p.sx, gy - R * 0.5, 2, p.sx, gy - R * 0.5, R * 2.6);
        g.addColorStop(0, "rgba(255,150,40,.55)"); g.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = g; ctx.fillRect(p.sx - R * 3, gy - R * 3.4, R * 6, R * 4);
        flame(p.sx - R * 0.55, gy, R * 1.5, R * 0.42, 1); flame(p.sx + R * 0.5, gy, R * 1.3, R * 0.4, 3); flame(p.sx, gy, R * 2.1, R * 0.6, 2);
        if (sc > 0.5) pill(p.sx, gy - R * 2.4 - 10, "FIRE \u00B7 " + metres(it.e), "#E5322D", "#fff", 11);
      } else if (it.k === "person") {
        figure(p.sx, gy, sc * 0.9);
        ctx.strokeStyle = "rgba(30,158,90,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.sx, gy, 22 * sc, 7 * sc, 0, 0, 7); ctx.stroke();
        pill(p.sx, gy - 52 * sc - 10, it.e.aided ? "SURVIVOR · AID SENT" : "SURVIVOR \u00B7 " + metres(it.e), "#1E9E5A", "#fff", 11);
      } else if (it.k === "packet") {
        const kk = Math.min(1, (frame - it.e.born) / 28), lift = (1 - kk) * (1 - kk) * 120 * sc, w = 9 * sc;
        ctx.fillStyle = "#FF7A1F"; ctx.strokeStyle = "#0D1C26"; ctx.lineWidth = 1.5;
        ctx.fillRect(p.sx - w, gy - 2 * w - lift, 2 * w, 2 * w); ctx.strokeRect(p.sx - w, gy - 2 * w - lift, 2 * w, 2 * w);
        ctx.fillStyle = "#fff"; ctx.fillRect(p.sx - w * 0.12, gy - 1.7 * w - lift, w * 0.24, w * 1.4); ctx.fillRect(p.sx - w * 0.6, gy - 1.1 * w - lift, w * 1.2, w * 0.24);
      } else if (it.k === "pip") {
        const alt = 70 * sc, py = gy - alt, w = 15 * sc;
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(p.sx, gy, w, w * 0.3, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "#FF5A14"; ctx.lineWidth = Math.max(1.5, 3 * sc);
        for (const dx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(p.sx + dx * w * 0.9, py - w * 0.15, w * 0.55, w * 0.18, 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = "#2A3035"; ctx.fillRect(p.sx - w * 0.6, py - w * 0.1, w * 1.2, w * 0.45);
        ctx.fillStyle = "#59D2FF"; ctx.beginPath(); ctx.arc(p.sx, py + w * 0.1, Math.max(1.5, w * 0.16), 0, 7); ctx.fill();
        if (sc > 0.35) pill(p.sx, py - w - 8, pipHold ? "PIP \u00B7 HOLD" : "PIP", "rgba(89,210,255,.85)", "#06232E", 10);
      }
    }

    const hz2 = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
    hz2.addColorStop(0, "rgba(0,0,0,0)"); hz2.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = hz2; ctx.fillRect(0, 0, W, H);
    if (hf > 0.05) { ctx.fillStyle = "rgba(255,110,40," + hf * 0.12 + ")"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "rgba(70,60,55," + hf * 0.3 + ")"; ctx.fillRect(0, 0, W, H); }
    drawTape();
    drawRange();
    ctx.strokeStyle = "rgba(230,237,242,.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, hz + 40); ctx.lineTo(W / 2 - 5, hz + 40); ctx.moveTo(W / 2 + 5, hz + 40); ctx.lineTo(W / 2 + 14, hz + 40); ctx.moveTo(W / 2, hz + 26); ctx.lineTo(W / 2, hz + 35); ctx.moveTo(W / 2, hz + 45); ctx.lineTo(W / 2, hz + 54); ctx.stroke();
  }

  let scan = null;
  function scanlines() {
    if (scan) return scan;
    const c = document.createElement("canvas");
    c.width = 4; c.height = 4;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 0, 4, 1);
    scan = ctx.createPattern(c, "repeat");
    return scan;
  }

  function heatSources() {
    const out = [
      { x: BASE.x, y: BASE.y, r: 20, v: 0.35, c: 31 },
      { x: bob.x, y: bob.y, r: 15, v: 0.55, c: 46 },
    ];
    for (const e of ents) {
      if (e.type === "fire") out.push({ x: e.x, y: e.y, r: 46, v: e.found ? 1 : 0.8, c: 380, name: "FIRE" });
      else if (e.type === "person") out.push({ x: e.x, y: e.y, r: 15, v: 0.82, c: 36, name: "PERSON" });
      else if (e.type === "packet") out.push({ x: e.x, y: e.y, r: 8, v: 0.2, c: 26 });
    }
    return out;
  }

  function drawPipStandby(t) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0A141B"); bg.addColorStop(1, "#050B10");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(89,210,255,.22)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(W / 2 - 120, H / 2 - 120, 240, 170, 18); ctx.stroke();
    drawPip(W / 2, H / 2 - 36, 3.4, t, false);
    pill(W / 2, H / 2 + 84, "PIP DOCKED", "rgba(89,210,255,.85)", "#06232E", 18);
    ctx.fillStyle = "#A9BAC6"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Press 4 to launch Pip, or P to keep it out.", W / 2, H / 2 + 120);
  }

  function drawPipCam(t, compact) {
    const hot = palette.colour, cy = (H - 28) / 2;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, hot(0)); bg.addColorStop(1, hot(0.07));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(zoom, zoom); ctx.translate(-pip.x, -pip.y);
    ctx.fillStyle = hot(0.18, 0.12);
    for (const [x, y, r] of SPECKS) ctx.fillRect(x, y, r * 1.5, r * 1.5);
    for (const [x, y, r] of RUBBLE) rubbleShape(x, y, r, 0, hot(0.04), hot(0.2));
    for (const s of heatSources()) {
      const r = s.r + (s.name === "FIRE" && !calm ? Math.sin(t / 5) * 5 : 0);
      const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, r);
      g.addColorStop(0, hot(s.v)); g.addColorStop(0.5, hot(s.v * 0.7)); g.addColorStop(1, hot(0, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
    }
    ctx.restore();

    const hw = W / (2 * zoom) - 8, hh = cy / zoom - 8;
    let top = null;
    for (const s of heatSources()) {
      if (!s.name || Math.abs(s.x - pip.x) > hw || Math.abs(s.y - pip.y) > hh) continue;
      if (!top || s.c > top.c) top = s;
    }
    if (top) {
      const sx = W / 2 + (top.x - pip.x) * zoom, sy = cy + (top.y - pip.y) * zoom, r = top.r * zoom * 0.55, k = Math.min(10, r * 0.5);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(sx + dx * r, sy + dy * (r - k)); ctx.lineTo(sx + dx * r, sy + dy * r); ctx.lineTo(sx + dx * (r - k), sy + dy * r);
      }
      ctx.stroke();
      pill(sx, sy - r - 14, top.name + " " + top.c + "\u00B0C", "rgba(0,0,0,.6)", "#fff", 11);
    }

    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, cy, 22, 0, 7); ctx.moveTo(W / 2 - 38, cy); ctx.lineTo(W / 2 - 10, cy); ctx.moveTo(W / 2 + 10, cy); ctx.lineTo(W / 2 + 38, cy); ctx.moveTo(W / 2, cy - 38); ctx.lineTo(W / 2, cy - 10); ctx.moveTo(W / 2, cy + 10); ctx.lineTo(W / 2, cy + 38); ctx.stroke();
    let reading = 24;
    for (const e of ents) if (e.type === "fire" && dist(pip, e) < 80) reading = Math.max(reading, 400 - dist(pip, e) * 4);
    for (const e of ents) if (e.type === "person" && dist(pip, e) < 40) reading = Math.max(reading, 36);
    pill(W / 2, cy + 60, "CENTRE " + Math.round(reading) + "\u00B0C", "rgba(0,0,0,.55)", "#fff", 11);

    const bar = ctx.createLinearGradient(0, 70, 0, 330);
    for (let i = 0; i <= 5; i++) bar.addColorStop(i / 5, hot(1 - i / 5));
    ctx.fillStyle = bar; ctx.fillRect(16, 70, 10, 260);
    tag(32, 78, "HOT", "rgba(0,0,0,.55)", "#fff", 10);
    tag(32, 322, "COOL", "rgba(0,0,0,.55)", "#fff", 10);
    tag(14, H - 44, "ALT " + (12 + (calm ? 0 : Math.sin(t / 30) * 0.4)).toFixed(1) + " m  \u00B7  ZOOM " + zoom.toFixed(1) + "\u00D7  \u00B7  " + palette.label.toUpperCase(), "rgba(0,0,0,.55)", "#fff", 10);
    if (!compact) { ctx.fillStyle = scanlines(); ctx.fillRect(0, 0, W, H - 28); }
  }

  function drawView(v, t, compact) {
    if (v === "bob") drawGround(t);
    else if (v === "pip") { if (pip) drawPipCam(t, compact); else drawPipStandby(t); }
    else drawMap(t);
  }

  function drawInset(t) {
    const src = insetSource(), { x, y, w, h } = insetRect();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.clip();
    ctx.translate(x, y); ctx.scale(w / W, w / W);
    drawView(src, t, true);
    ctx.restore();
    ctx.strokeStyle = "rgba(230,237,242,.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
    tag(x + 8, y + 14, VIEW_SHORT[src] + "  \u00B7  X swaps", "rgba(5,11,16,.72)", "#E6EDF2", 9);
  }

  function drawHelp() {
    const w = 430, h = 58 + HELP.length * 22, x = (W - w) / 2, y = (H - 28 - h) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(3,9,13,.82)"; ctx.fillRect(0, 0, W, H - 28);
    ctx.fillStyle = "#0E202C"; ctx.strokeStyle = "rgba(230,237,242,.25)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = "#FFD21F"; ctx.font = "bold 14px sans-serif"; ctx.fillText("KEYBOARD", x + 22, y + 32);
    ctx.textAlign = "right"; ctx.fillStyle = "#8EA3B2"; ctx.font = "11px sans-serif"; ctx.fillText("H or Esc to close", x + w - 22, y + 32);
    ctx.textAlign = "left";
    HELP.forEach(([keysText, what], i) => {
      const ry = y + 60 + i * 22;
      ctx.fillStyle = "#E6EDF2"; ctx.font = "bold 12px sans-serif"; ctx.fillText(keysText, x + 22, ry);
      ctx.fillStyle = "#A9BAC6"; ctx.font = "12px sans-serif"; ctx.fillText(what, x + 200, ry);
    });
    ctx.restore();
  }

  function overlay(t) {
    const chips = [];
    const fire = ents.find((x) => x.type === "fire"), person = ents.find((x) => x.type === "person");
    const aid = ents.some((x) => x.type === "packet");
    chips.push(["FIRE", !fire ? "NONE" : fire.found ? "DISCOVERED" : "REPORTED", fire && fire.found ? "#E5322D" : "rgba(255,255,255,.14)"]);
    chips.push(["SURVIVOR", !person ? "NONE" : person.found ? "FOUND" : "SEARCHING", person && person.found ? "#1E9E5A" : "rgba(255,255,255,.14)"]);
    chips.push(["AID", aid ? "DROPPED" : "NONE", aid ? "#FF7A1F" : "rgba(255,255,255,.14)"]);
    let x = 74;
    for (const [k, v, col] of chips) {
      ctx.font = "bold 10px sans-serif";
      const w = ctx.measureText(k + "  " + v).width + 18;
      ctx.fillStyle = "rgba(5,11,16,.72)"; ctx.beginPath(); ctx.roundRect(x, 10, w, 22, 11); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 11, 21, 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#E6EDF2"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(k + "  " + v, x + 19, 21.5);
      ctx.textBaseline = "alphabetic"; x += w + 6;
    }
    ctx.textAlign = "center";
    pill(W - 176, 21, VIEW_NAME[view], "rgba(5,11,16,.72)", "#C9D6DF", 10);
    if (view !== "map") {
      ctx.fillStyle = "rgba(229,50,45," + (calm || frame % 60 < 36 ? 1 : 0.2) + ")"; ctx.beginPath(); ctx.arc(W - 228, 21, 4, 0, 7); ctx.fill();
    }

    banners = banners.filter((b) => frame - b.born < 190);
    banners.slice(-2).reverse().forEach((b, i) => {
      const age = frame - b.born, a = Math.min(1, age / 10, (190 - age) / 24), rise = calm ? 0 : (1 - Math.min(1, age / 12)) * 14;
      const cols = { alert: ["#E5322D", "#fff"], ok: ["#1E9E5A", "#fff"], aid: ["#FF7A1F", "#1A0F06"] }[b.kind];
      ctx.save(); ctx.globalAlpha = Math.max(0, a) * (i ? 0.8 : 1);
      pill(W / 2, 92 + i * 46 - rise, b.text, cols[0], cols[1], i ? 20 : 26);
      ctx.restore();
    });
  }

  function draw() {
    const t = calm ? 0 : frame;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineCap = "butt";
    drawView(view, t, false);
    if (insetOn) drawInset(t);
    overlay(t);
    if (help) drawHelp();

    ctx.fillStyle = "rgba(5,11,16,.9)"; ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = "#E6EDF2"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    const pipText = pip ? "PIP " + (pipHold ? "HOLD" : Math.round(pip.bat) + "%") + "    " : "";
    ctx.fillText("TEMP " + Math.round(temp()) + "\u00B0C    HDG " + pad(headingDeg()).padStart(3, "0") + "\u00B0    BATT " + Math.round(battery) + "%    " + pipText + (target ? "AUTO" : "MANUAL") + "    T+" + elapsed(), 14, H - 9);
    ctx.textAlign = "center";
  }

  function loop() {
    frame++; step(); draw();
    if (pipStateText() !== lastPipState) syncPipUi();
    if (on) raf = requestAnimationFrame(loop);
  }

  function stop() {
    on = false; cancelAnimationFrame(raf);
    cv.hidden = true; panel.hidden = true; fullBtn.hidden = true;
    if (document.fullscreenElement) document.exitFullscreen();
    btn.setAttribute("aria-pressed", false); btn.textContent = "Demo view";
  }

  function start() {
    claim("demo");
    S.stopDemo = stop;
    on = true; help = false; setView("map"); reset();
    btn.setAttribute("aria-pressed", true); btn.textContent = "Demo view: on";
    feed.hidden = true; rtc.hidden = true; ph.hidden = true; cv.hidden = false; panel.hidden = false; fullBtn.hidden = false;
    fit();
    setStatus("demo", "Demo", "Simulated mission. Bob isn't connected. Drive with WASD or the arrow keys. Press H for all keys.");
    loop(); cv.focus({ preventScroll: true });
  }

  btn.addEventListener("click", () => {
    if (on) endActive();
    else start();
  });

  viewBtns.forEach((b) => b.addEventListener("click", () => { setView(b.dataset.view); cv.focus({ preventScroll: true }); }));
  panel.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cmd]");
    if (c) { COMMANDS[c.dataset.cmd](); cv.focus({ preventScroll: true }); }
  });

  cv.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const drive = driveKeyFor(e.code);
    if (drive) { keys[drive] = true; e.preventDefault(); return; }
    if (e.key === "Shift") { keys.Shift = true; return; }
    const action = actionFor(e.key);
    if (!action || (action === "closehelp" && !help)) return;
    if (!e.repeat || action === "zoomin" || action === "zoomout") COMMANDS[action]();
    e.preventDefault();
  });

  function canvasPoint(e) {
    const r = cv.getBoundingClientRect();
    const k = Math.min(r.width / W, r.height / H);
    return { x: (e.clientX - r.left - (r.width - W * k) / 2) / k, y: (e.clientY - r.top - (r.height - H * k) / 2) / k };
  }

  function sendTo(p) {
    const spot = { x: Math.max(24, Math.min(W - 24, p.x)), y: Math.max(24, Math.min(H - 48, p.y)) };
    pings.push({ x: spot.x, y: spot.y, born: frame });
    if (pings.length > 4) pings.shift();
    if (goto(spot, 12, () => log("Arrived at the marked position.", "ok"))) log("Going to the marked position.");
  }

  cv.addEventListener("pointerdown", (e) => {
    cv.focus({ preventScroll: true });
    const p = canvasPoint(e);
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H - 28) return;
    if (help) { help = false; return; }
    const box = insetRect();
    if (insetOn && p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) { COMMANDS.swap(); return; }
    if (view === "map") sendTo(p);
  });

  cv.addEventListener("wheel", (e) => {
    if (view !== "pip" || !pip) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? ZOOM.step : -ZOOM.step));
  }, { passive: false });

  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(cv);
  fullBtn.addEventListener("click", () => { $("full").click(); cv.focus({ preventScroll: true }); });
  document.addEventListener("fullscreenchange", () => {
    fullBtn.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
    if (on) cv.focus({ preventScroll: true });
  });
  cv.addEventListener("keyup", (e) => {
    const drive = driveKeyFor(e.code);
    if (drive) delete keys[drive];
    if (e.key === "Shift") delete keys.Shift;
  });
  cv.addEventListener("blur", () => { keys = {}; });
  panel.querySelectorAll("[data-key]").forEach((b) => {
    const k = b.dataset.key;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); keys[k] = true; });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { delete keys[k]; }));
  });
}