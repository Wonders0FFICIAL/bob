import { GROUPS, SCHEMES, DEFAULT_SCHEME, namesIn, materialFor } from "./model-data.js";

const MODEL_URL = "models/bob-v2.glb";
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
  const resetBtn = root.querySelector('[data-act="reset"]');
  const zoomIn = root.querySelector('[data-act="zoom-in"]');
  const zoomOut = root.querySelector('[data-act="zoom-out"]');
  const actionBtns = [doorsBtn, lightsBtn, resetBtn, zoomIn, zoomOut];

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const intro = { title: title.textContent, text: text.textContent };

  let viewer = null;
  let loading = false;
  let names = [];
  let selected = null;
  let lightsOff = false;
  let schemeId = DEFAULT_SCHEME;

  function setEnabled(on) {
    for (const b of [...partBtns, ...actionBtns]) if (b) b.disabled = !on;
    for (const i of schemeInputs) i.disabled = !on;
  }
  setEnabled(false);

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

  function select(id) {
    selected = id;
    for (const b of partBtns) b.setAttribute("aria-pressed", String(b.dataset.part === id));
    const g = GROUPS.find((x) => x.id === id);
    if (!g) {
      title.textContent = intro.title;
      text.textContent = intro.text;
      viewer.highlight(null);
      return;
    }
    title.textContent = g.title;
    text.textContent = g.text;
    const list = namesIn(g, names);
    viewer.highlight(list);
    viewer.focus(list);
    if (id === "hangar" && doorsBtn.getAttribute("aria-pressed") !== "true") toggleDoors(true);
  }

  function toggleDoors(force) {
    const open = typeof force === "boolean" ? force : doorsBtn.getAttribute("aria-pressed") !== "true";
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

  function wire() {
    for (const b of partBtns) b.addEventListener("click", () => select(selected === b.dataset.part ? null : b.dataset.part));
    for (const i of schemeInputs) i.addEventListener("change", () => { if (i.checked) applyScheme(i.value); });
    doorsBtn.addEventListener("click", () => toggleDoors());
    lightsBtn.addEventListener("click", toggleLights);
    resetBtn.addEventListener("click", () => {
      select(null);
      viewer.resetView();
    });
    zoomIn.addEventListener("click", () => viewer.zoom(0.8));
    zoomOut.addEventListener("click", () => viewer.zoom(1.25));
    canvas.addEventListener("keydown", (e) => {
      const step = 0.25;
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
      if (viewer) viewer.setVisible(inView);
      else if (inView && !saveData) load();
    },
    { rootMargin: "300px" }
  ).observe(root);
}
