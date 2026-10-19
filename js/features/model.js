import { GROUPS, PIP_GROUPS, SCHEMES, DEFAULT_SCHEME, namesIn, materialFor } from "./model-data.js";

const MODEL_URL = "models/bob-v3.glb";
const PIP_URL = "models/pip.glb";
const FALLBACK = "Your browser can't show the 3D model, so here is a picture instead.";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function initModel() {
  const root = document.getElementById("bob3d");
  if (!root) return;

  const canvas = root.querySelector(".bob3d-canvas");
  const msg = root.querySelector(".bob3d-msg");
  const loadBtn = root.querySelector(".bob3d-load");
  const title = root.querySelector(".bob3d-title");
  const text = root.querySelector(".bob3d-text");
  const partBtns = [...root.querySelectorAll("[data-part]")];
  const schemeInputs = [...root.querySelectorAll('input[name="bob3d-scheme"]')];
  const schemeNote = root.querySelector(".bob3d-scheme-note");
  const doorsBtn = root.querySelector('[data-act="doors"]');
  const lightsBtn = root.querySelector('[data-act="lights"]');
  const shellBtn = root.querySelector('[data-act="shell"]');
  const tourBtn = root.querySelector('[data-act="tour"]');
  const fullBtn = root.querySelector('[data-act="full"]');
  const flyBtn = root.querySelector('[data-act="fly"]');
  const modeBtns = [...root.querySelectorAll("[data-mode]")];
  const partSets = [...root.querySelectorAll("[data-set]")];
  const resetBtn = root.querySelector('[data-act="reset"]');
  const zoomIn = root.querySelector('[data-act="zoom-in"]');
  const zoomOut = root.querySelector('[data-act="zoom-out"]');
  const actionBtns = [doorsBtn, lightsBtn, shellBtn, tourBtn, fullBtn, flyBtn, ...modeBtns, resetBtn, zoomIn, zoomOut];

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const intros = {
    bob: { title: title.textContent, text: text.textContent },
    pip: { title: "Pip", text: "Pip is Bob's micro-drone. It is a design plan and is not built yet. Drag to turn it, or pick a part to zoom in on it." },
  };

  let viewer = null;
  let loading = false;
  let names = [];
  let selected = null;
  let mode = "bob";
  let switching = false;
  let flying = false;
  let flyTimer = 0;
  const visibleParts = () => partBtns.filter((b) => (mode === "pip") === b.dataset.part.startsWith("pip-"));
  let lightsOff = false;
  let schemeId = DEFAULT_SCHEME;

  function setEnabled(on) {
    for (const b of [...partBtns, ...actionBtns]) if (b) b.disabled = !on;
    for (const i of schemeInputs) i.disabled = !on;
  }
  setEnabled(false);
  if (!document.fullscreenEnabled) fullBtn.hidden = true;

  function applyScheme(id) {
    const s = SCHEMES.find((x) => x.id === id) || SCHEMES[0];
    schemeId = s.id;
    for (const n of names) {
      const mat = materialFor(s, n);
      if (mat) viewer.setMaterial([n], mat);
    }
    applyLights();
    if (schemeNote) schemeNote.textContent = s.note;
  }

  function applyLights() {
    viewer.setLightsOff(lightsOff);
    const s = SCHEMES.find((x) => x.id === schemeId) || SCHEMES[0];
    const tape = names.filter((n) => /^Reflective tape/.test(n));
    viewer.setMaterial(tape, { ...s.roles.tape, emissiveIntensity: lightsOff ? 0.95 : s.roles.tape.emissiveIntensity });
    root.classList.toggle("is-dark", lightsOff);
  }

  const INSIDE = ["chassis", "suspension", "wheels", "payload"];

  function select(id) {
    selected = id;
    for (const b of partBtns) b.setAttribute("aria-pressed", String(b.dataset.part === id));
    const g = [...GROUPS, ...PIP_GROUPS].find((x) => x.id === id);
    if (!g) {
      title.textContent = intros[mode].title;
      text.textContent = intros[mode].text;
      viewer.highlight(null);
      return;
    }
    title.textContent = g.title;
    text.textContent = g.text;
    const list = namesIn(g, names);
    if (mode === "bob") setShell(INSIDE.includes(id));
    viewer.highlight(list);
    viewer.focus(list, g.view);
    if (id === "hangar" && doorsBtn.getAttribute("aria-pressed") !== "true") toggleDoors(true);
  }

  function toggleDoors(force) {
    const open = typeof force === "boolean" ? force : doorsBtn.getAttribute("aria-pressed") !== "true";
    if (!open && flying) stopFly();
    doorsBtn.setAttribute("aria-pressed", String(open));
    doorsBtn.textContent = open ? "Close hangar" : "Open hangar";
    viewer.setDoorsOpen(open);
  }

  function toggleLights() {
    lightsOff = !lightsOff;
    lightsBtn.setAttribute("aria-pressed", String(lightsOff));
    lightsBtn.textContent = lightsOff ? "Lights on" : "Lights off";
    applyLights();
  }

  function setShell(hide) {
    if (shellBtn.getAttribute("aria-pressed") === String(hide)) return;
    shellBtn.setAttribute("aria-pressed", String(hide));
    shellBtn.textContent = hide ? "Show shell" : "Hide shell";
    viewer.setHidden(names.filter((n) => /^(Outer shell|Fender|BOB lettering|Eye ring|Reflective tape)/.test(n)), hide);
  }

  function toggleShell() {
    setShell(shellBtn.getAttribute("aria-pressed") !== "true");
  }

  let tourTimer = 0;
  let tourIndex = 0;

  function stopTour() {
    if (!tourTimer) return;
    clearTimeout(tourTimer);
    tourTimer = 0;
    tourBtn.setAttribute("aria-pressed", "false");
    tourBtn.textContent = "Tour";
  }

  function tourStep() {
    const list = visibleParts();
    const id = list[tourIndex % list.length].dataset.part;
    tourIndex++;
    select(id);
    tourTimer = setTimeout(tourStep, calm ? 6000 : 4800);
  }

  function toggleTour() {
    if (tourTimer) {
      stopTour();
      return;
    }
    tourBtn.setAttribute("aria-pressed", "true");
    tourBtn.textContent = "Stop tour";
    tourIndex = 0;
    tourStep();
  }

  function flyUi(on) {
    flying = on;
    flyBtn.setAttribute("aria-pressed", String(on));
    flyBtn.textContent = mode === "pip" ? (on ? "Stop props" : "Spin props") : on ? "Land Pip" : "Launch Pip";
  }

  function stopFly() {
    clearTimeout(flyTimer);
    flyTimer = 0;
    if (flying) viewer.setFlight(false);
    flyUi(false);
  }

  function toggleFly() {
    if (flying) {
      stopFly();
      return;
    }
    flyUi(true);
    if (mode === "bob" && doorsBtn.getAttribute("aria-pressed") !== "true") {
      toggleDoors(true);
      flyTimer = setTimeout(() => { if (flying) viewer.setFlight(true); }, calm ? 0 : 650);
    } else {
      viewer.setFlight(true);
    }
  }

  async function setMode(next) {
    if (next === mode || switching) return;
    switching = true;
    stopTour();
    if (next === "pip" && !viewer.hasPip()) {
      msg.textContent = "Loading Pip…";
      msg.hidden = false;
      try {
        await viewer.loadPip(PIP_URL);
      } catch (e) {
        console.error("Pip failed to load:", e);
        msg.textContent = "Couldn't load Pip. Try again in a moment.";
        switching = false;
        return;
      }
      msg.hidden = true;
    }
    stopFly();
    mode = next;
    viewer.highlight(null);
    viewer.setMode(next);
    names = viewer.names();
    applyScheme(schemeId);
    for (const b of modeBtns) b.setAttribute("aria-pressed", String(b.dataset.mode === next));
    for (const set of partSets) set.hidden = set.dataset.set !== next;
    doorsBtn.hidden = next === "pip";
    shellBtn.hidden = next === "pip";
    flyUi(false);
    select(null);
    switching = false;
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  }

  const KEYS = { o: () => mode === "bob" && toggleDoors(), h: () => mode === "bob" && toggleShell(), p: () => setMode(mode === "bob" ? "pip" : "bob"), g: toggleFly, l: toggleLights, t: toggleTour, f: toggleFull, r: () => { stopTour(); select(null); viewer.resetView(); } };

  function wire() {
    shellBtn.addEventListener("click", () => { stopTour(); toggleShell(); });
    tourBtn.addEventListener("click", toggleTour);
    flyBtn.addEventListener("click", toggleFly);
    for (const b of modeBtns) b.addEventListener("click", () => setMode(b.dataset.mode));
    fullBtn.addEventListener("click", toggleFull);
    canvas.addEventListener("pointerdown", stopTour);
    document.addEventListener("fullscreenchange", () => {
      fullBtn.textContent = document.fullscreenElement === root ? "Exit full screen" : "Full screen";
      if (viewer) canvas.focus({ preventScroll: true });
    });
    for (const b of partBtns) b.addEventListener("click", () => { stopTour(); select(selected === b.dataset.part ? null : b.dataset.part); });
    for (const i of schemeInputs) i.addEventListener("change", () => { if (i.checked) applyScheme(i.value); });
    doorsBtn.addEventListener("click", () => toggleDoors());
    lightsBtn.addEventListener("click", toggleLights);
    resetBtn.addEventListener("click", () => {
      stopTour();
      select(null);
      viewer.resetView();
    });
    zoomIn.addEventListener("click", () => viewer.zoom(0.8));
    zoomOut.addEventListener("click", () => viewer.zoom(1.25));
    canvas.addEventListener("keydown", (e) => {
      const step = 0.25;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (KEYS[k]) { if (!e.repeat) KEYS[k](); e.preventDefault(); return; }
        if (/^[1-9]$/.test(e.key) && visibleParts()[Number(e.key) - 1]) {
          stopTour();
          if (!e.repeat) visibleParts()[Number(e.key) - 1].click();
          e.preventDefault();
          return;
        }
      }
      if (e.key === "ArrowLeft") viewer.rotate(-step, 0);
      else if (e.key === "ArrowRight") viewer.rotate(step, 0);
      else if (e.key === "ArrowUp") viewer.rotate(0, -step);
      else if (e.key === "ArrowDown") viewer.rotate(0, step);
      else if (e.key === "+" || e.key === "=") viewer.zoom(0.8);
      else if (e.key === "-") viewer.zoom(1.25);
      else return;
      e.preventDefault();
    });
  }

  function fail(note) {
    root.dataset.state = "fallback";
    msg.textContent = note;
    msg.hidden = false;
    if (loadBtn) loadBtn.hidden = true;
  }

  async function load() {
    if (loading || viewer) return;
    loading = true;
    if (loadBtn) loadBtn.hidden = true;
    if (!hasWebGL()) return fail(FALLBACK);
    root.dataset.state = "loading";
    msg.textContent = "Loading 3D model…";
    msg.hidden = false;
    try {
      const mod = await import("../viewer/bob-viewer.js");
      viewer = await mod.createViewer({ canvas, modelUrl: MODEL_URL, calm });
      names = viewer.names();
      wire();
      applyScheme(schemeId);
      setEnabled(true);
      root.dataset.state = "ready";
      msg.hidden = true;
      viewer.setVisible(inView);
    } catch (e) {
      console.error("3D viewer failed:", e);
      viewer = null;
      loading = false;
      fail(FALLBACK);
    }
  }

  let inView = false;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  if (saveData) {
    msg.textContent = "Data saver is on, so the 3D model is not loaded automatically.";
    msg.hidden = false;
    if (loadBtn) {
      loadBtn.hidden = false;
      loadBtn.addEventListener("click", load);
    }
  }

  if (!("IntersectionObserver" in window)) {
    inView = true;
    if (!saveData) load();
    return;
  }

  new IntersectionObserver(
    (entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (viewer) {
        viewer.setVisible(inView);
        if (!inView) stopTour();
      } else if (inView && !saveData) load();
    },
    { rootMargin: "300px" }
  ).observe(root);
}
