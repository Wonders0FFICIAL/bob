import { initTheme } from "../features/theme.js";
import { JUDGE_PASSCODES } from "./config.js";

const $ = (id) => document.getElementById(id);

initTheme();

const FIELDS = [
  { id: "pcCamera", value: JUDGE_PASSCODES.camera },
  { id: "pcViewer", value: JUDGE_PASSCODES.viewer },
];

const filled = FIELDS.every((f) => typeof f.value === "string" && f.value.length > 0);
$("pcLocked").hidden = filled;
$("pcOpen").hidden = !filled;

for (const f of FIELDS) {
  const out = $(f.id);
  const btn = $(f.id + "Show");
  const copy = $(f.id + "Copy");
  let shown = false;

  btn.addEventListener("click", () => {
    shown = !shown;
    out.textContent = shown ? f.value : "•".repeat(Math.max(f.value.length, 8));
    btn.textContent = shown ? "Hide" : "Show";
    btn.setAttribute("aria-pressed", String(shown));
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(f.value);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Press Show and copy by hand";
    }
    setTimeout(() => { copy.textContent = "Copy"; }, 1800);
  });

  out.textContent = "•".repeat(Math.max(f.value.length, 8));
}

const reveal = [...document.querySelectorAll("[data-reveal]")];
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  for (const el of reveal) { el.classList.add("pre"); io.observe(el); }
}
