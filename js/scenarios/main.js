import { initTheme } from "../features/theme.js";
import { DEFAULT_PALETTE, nextPalette } from "../features/thermal.js";
import { W, H, SCENARIOS, byId } from "./worlds.js";
import { createSim, step, drainEvents, goTo, launchPip, recallPip, setPipOn, runAuto, sendBobToSignal } from "./sim.js";
import { draw } from "./render.js";

const $ = (id) => document.getElementById(id);

initTheme();

const cv = $("scene"), ctx = cv.getContext("2d"), stage = $("stage");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cards = [...document.querySelectorAll("[data-scn]")];
const SPEEDS = [1, 2, 4];
const TIMES_KEY = "bob.scenarios.times";

const ui = { scale: 1, calm, inset: true, palette: DEFAULT_PALETTE, banners: [], frame: 0 };
let def = byId((location.hash || "").slice(1));
let tick = 0, sim = null, pipOn = true, speedIdx = 0, acc = 0, last = 0, raf = 0, visible = true, shown = false;
const keys = {};
const HAZARD = { smoke: "Smoke", water: "Floodwater" };

function starsFor(f) {
  const done = f.found >= f.total;
  if (!done) return 1;
  return f.located <= def.par ? 3 : f.located <= def.par * 2.5 ? 2 : 1;
}

function starText(n) {
  const span = document.createElement("span");
  for (let i = 0; i < 3; i++) { const o = document.createElement("span"); o.textContent = "\u2605"; if (i < n) o.className = "on"; span.append(o); }
  return span.childNodes;
}

function paintCards() {
  const times = readTimes();
  for (const c of cards) {
    const el = c.querySelector(".sc-best"), t = times[c.dataset.scn];
    el.textContent = "";
    if (!t || !t.stars) { el.textContent = "Not played yet"; continue; }
    const st = document.createElement("span"); st.className = "on";
    st.textContent = "\u2605".repeat(t.stars) + "\u2606".repeat(3 - t.stars);
    el.append(st, " Best " + clock(Math.min(t.pip || 1e9, t.alone || 1e9)));
  }
}

function paintStart() {
  $("startname").textContent = def.name;
  const chipsEl = $("startchips"); chipsEl.textContent = "";
  const items = [def.survivors.length + " survivors"];
  if (def.hazards && HAZARD[def.hazards]) items.push(HAZARD[def.hazards]);
  if (def.event) items.push(def.event.banner.charAt(0) + def.event.banner.slice(1).toLowerCase() + " coming");
  if (def.flyMaxX) items.push("Pip range limited");
  if (def.survivors.some((x) => x.island)) items.push("Deep water");
  for (const t of items) { const li = document.createElement("li"); li.textContent = t; chipsEl.append(li); }
  $("startpar").textContent = "Par time " + clock(def.par) + " for three stars.";
  $("start").hidden = false;
}

function hideStart() { $("start").hidden = true; }

function fit() {
  const w = cv.clientWidth;
  if (!w) return;
  const want = Math.min(3, Math.max(1, Math.ceil(w * (window.devicePixelRatio || 1) / W)));
  if (want === ui.scale && cv.width === W * want) return;
  ui.scale = want; cv.width = W * want; cv.height = H * want;
}

function readTimes() { try { return JSON.parse(localStorage.getItem(TIMES_KEY)) || {}; } catch { return {}; } }
function writeTimes(t) { try { localStorage.setItem(TIMES_KEY, JSON.stringify(t)); } catch {} }

const clock = (frames) => { const s = Math.round(frames / 60); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

function log(text, kind) {
  const li = document.createElement("li");
  if (kind && kind !== "info") li.className = kind;
  const b = document.createElement("b");
  b.textContent = clock(sim.frame);
  li.append(b, text);
  $("log").prepend(li);
  while ($("log").children.length > 7) $("log").lastChild.remove();
}

function banner(text, kind) { ui.banners.push({ text, kind, born: ui.frame }); if (ui.banners.length > 3) ui.banners.shift(); }

function renderSteps() {
  const list = $("scsteps");
  list.textContent = "";
  for (const text of def.steps) { const li = document.createElement("li"); li.textContent = text; list.append(li); }
}

function progress() {
  const s = sim, sig = s.survivors.some((x) => x.state !== "unknown"), got = s.survivors.some((x) => x.reached);
  const all = s.survivors.every((x) => x.reached), aid = s.survivors.some((x) => x.aided);
  return [!!s.pip || sig || got || !!s.finished, sig || got, got, aid || (all && (!s.pipOn || !!s.def.flyMaxX)), !!s.finished];
}

function syncUi() {
  const p = progress(), items = [...$("scsteps").children];
  let firstOpen = p.findIndex((x) => !x);
  if (firstOpen < 0) firstOpen = p.length;
  items.forEach((li, i) => { li.classList.toggle("done", !!p[i] && i < firstOpen || !!p[i]); li.classList.toggle("now", i === firstOpen); });
  $("pipgo").textContent = sim.pip ? "Recall Pip " : "Launch Pip ";
  const kb = document.createElement("kbd"); kb.textContent = "L"; $("pipgo").append(kb);
  $("pipgo").disabled = !pipOn;
  $("pipbay").setAttribute("aria-pressed", String(pipOn));
  $("pipbay").firstChild.textContent = pipOn ? "Pip on board " : "Pip removed ";
  $("run").firstChild.textContent = sim.auto ? "Restart scenario " : "Run scenario ";
}

function showResult() {
  const f = sim.finished, times = readTimes(), key = def.id;
  const mode = f.pip ? "pip" : "alone";
  times[key] = times[key] || {};
  const prev = times[key][mode];
  if (!prev || f.located < prev) times[key][mode] = f.located;
  const stars = starsFor(f);
  times[key].stars = Math.max(times[key].stars || 0, stars);
  writeTimes(times);
  paintCards();
  const st = $("stars"); st.textContent = ""; st.append(...starText(stars)); st.setAttribute("aria-label", stars + " of 3 stars");
  $("flip").textContent = f.pip ? "Try without Pip" : "Try with Pip";
  $("next").hidden = SCENARIOS.length < 2;
  const rows = [["Survivors reached", f.found + " of " + f.total], ["Located in", clock(f.located)], ["Aid packets dropped", f.aided + (f.pip ? "" : " (Pip off)")], ["Bob battery left", f.battery + "%"]];
  const dl = $("resultlist"); dl.textContent = "";
  for (const [k, v] of rows) { const d = document.createElement("div"); const a = document.createElement("dt"), b = document.createElement("dd"); a.textContent = k; b.textContent = v; d.append(a, b); dl.append(d); }
  const t = times[key];
  let note = "Run it again with Pip " + (f.pip ? "removed" : "on board") + " to compare.";
  if (t.pip && t.alone) note = t.pip < t.alone ? "Best times: with Pip " + clock(t.pip) + ", Bob alone " + clock(t.alone) + ". Pip saved " + clock(t.alone - t.pip) + "." : "Best times: with Pip " + clock(t.pip) + ", Bob alone " + clock(t.alone) + ". In this scenario Pip doesn't speed things up.";
  $("resultnote").textContent = note;
  $("result").hidden = false;
}

function fresh() {
  sim = createSim(def, { pipOn });
  ui.banners = []; ui.frame = 0; acc = 0;
  $("log").textContent = "";
  $("result").hidden = true;
  log("Bob is at base. " + (pipOn ? "Pip is docked in his hangar." : "Pip is not on board."));
  cv.setAttribute("data-scenario", def.id);
  paintStart();
  syncUi();
}

function select(id, push) {
  def = byId(id);
  for (const c of cards) c.setAttribute("aria-pressed", String(c.dataset.scn === def.id));
  $("scname").textContent = def.name;
  $("scblurb").textContent = def.blurb;
  renderSteps();
  if (push) history.replaceState(null, "", "#" + def.id);
  fresh();
}

function handle(events) {
  for (const e of events) {
    log(e.text, e.kind);
    if (e.banner) banner(e.banner, e.type === "aid" ? "aid" : e.type === "signal" ? "alert" : e.kind === "ok" ? "ok" : "info");
    if (e.type === "done") showResult();
  }
}

function frameLoop(now) {
  raf = requestAnimationFrame(frameLoop);
  if (!visible || document.hidden) { last = now; return; }
  const dt = Math.min(100, now - (last || now)); last = now;
  acc += dt * SPEEDS[speedIdx] * 0.06;
  let guard = 0;
  while (acc >= 1 && guard++ < 24) {
    acc -= 1; ui.frame++;
    step(sim, { left: keys.left, right: keys.right, up: keys.up, down: keys.down });
    handle(drainEvents(sim));
  }
  draw(ctx, sim, ui);
  if (++tick % 8 === 0) syncUi();
}

function runScenario() { fresh(); hideStart(); runAuto(sim); handle(drainEvents(sim)); syncUi(); }

function goHome() {
  hideStart(); sim.auto = null;
  if (goTo(sim, sim.def.base, 8, "base")) log("Bob is heading back to base.");
  handle(drainEvents(sim));
}

function nextScenario() { const i = SCENARIOS.findIndex((x) => x.id === def.id); select(SCENARIOS[(i + 1) % SCENARIOS.length].id, true); }

function togglePip() { if (sim.pip) recallPip(sim); else launchPip(sim); handle(drainEvents(sim)); syncUi(); }

function setPip(on) {
  pipOn = on; setPipOn(sim, on); handle(drainEvents(sim)); syncUi();
}

function cycleSpeed() { speedIdx = (speedIdx + 1) % SPEEDS.length; $("speed").textContent = SPEEDS[speedIdx] + "x"; }

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (stage.requestFullscreen) stage.requestFullscreen();
}

const DRIVE = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: null, A: "left", D: "right", W: "up" };
function pick(i) { if (SCENARIOS[i]) select(SCENARIOS[i].id, true); }
const ACTIONS = {
  " ": runScenario, Enter: runScenario, l: togglePip, L: togglePip, n: () => { sendBobToSignal(sim); handle(drainEvents(sim)); }, N: () => { sendBobToSignal(sim); handle(drainEvents(sim)); },
  p: () => setPip(!pipOn), P: () => setPip(!pipOn), i: () => $("inset").click(), I: () => $("inset").click(), c: () => { ui.palette = nextPalette(ui.palette).id; }, C: () => { ui.palette = nextPalette(ui.palette).id; },
  r: () => fresh(), R: () => fresh(), b: goHome, B: goHome, 1: () => pick(0), 2: () => pick(1), 3: () => pick(2), 4: () => pick(3), f: toggleFull, F: toggleFull, S: cycleSpeed,
};

cv.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key in DRIVE && DRIVE[e.key]) { hideStart(); keys[DRIVE[e.key]] = true; e.preventDefault(); return; }
  if (e.key === "s") { if (keys.up || keys.left || keys.right) { keys.down = true; } else cycleSpeed(); e.preventDefault(); return; }
  const act = ACTIONS[e.key];
  if (act) { if (!e.repeat) act(); e.preventDefault(); }
});
cv.addEventListener("keyup", (e) => { const k = DRIVE[e.key]; if (k) delete keys[k]; if (e.key === "s") delete keys.down; });
cv.addEventListener("blur", () => { for (const k of Object.keys(keys)) delete keys[k]; });

cv.addEventListener("click", (e) => {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (y > H - 30) return;
  hideStart(); sim.auto = null;
  if (goTo(sim, { x, y }, 8)) log("Bob is heading to the spot you picked.");
  handle(drainEvents(sim));
  cv.focus({ preventScroll: true });
});

for (const c of cards) c.addEventListener("click", () => select(c.dataset.scn, true));
$("run").addEventListener("click", () => { runScenario(); cv.focus({ preventScroll: true }); });
$("pipgo").addEventListener("click", () => { togglePip(); cv.focus({ preventScroll: true }); });
$("signal").addEventListener("click", () => { ACTIONS.n(); cv.focus({ preventScroll: true }); });
$("pipbay").addEventListener("click", () => setPip(!pipOn));
$("inset").addEventListener("click", () => { ui.inset = !ui.inset; $("inset").setAttribute("aria-pressed", String(ui.inset)); });
$("reset").addEventListener("click", () => fresh());
$("play").addEventListener("click", () => { runScenario(); cv.focus({ preventScroll: true }); });
$("home").addEventListener("click", () => { goHome(); cv.focus({ preventScroll: true }); });
$("again").addEventListener("click", () => { fresh(); cv.focus({ preventScroll: true }); });
$("next").addEventListener("click", () => { nextScenario(); cv.focus({ preventScroll: true }); });
$("flip").addEventListener("click", () => { setPip(!pipOn); runScenario(); cv.focus({ preventScroll: true }); });
$("speed").addEventListener("click", cycleSpeed);
$("full").addEventListener("click", toggleFull);
document.addEventListener("fullscreenchange", () => { $("full").textContent = document.fullscreenElement ? "Exit full screen" : "Full screen"; fit(); });
window.addEventListener("hashchange", () => select((location.hash || "").slice(1), false));
if ("ResizeObserver" in window) new ResizeObserver(fit).observe(cv);
if ("IntersectionObserver" in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.05 }).observe(stage);

fit();
paintCards();
select(def.id, false);
raf = requestAnimationFrame(frameLoop);
