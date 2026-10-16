import { $ } from "../dom.js";
import { store, KEYS } from "../storage.js";

export function initTheme() {
  const btn = $("theme"), label = $("themelabel"), root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const THEMES = ["light", "dark"];
  const NAMES = { light: "Day", dark: "Night" };
  const COLORS = { light: "#EDF1F3", dark: "#0A141B" };
  const following = () => THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % THEMES.length];

  function sync() {
    const next = following();
    label.textContent = NAMES[next];
    btn.setAttribute("aria-label", "Switch to " + NAMES[next].toLowerCase() + " theme");
  }

  btn.addEventListener("click", () => {
    const next = following();
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    if (meta) meta.content = COLORS[next];
    store.write(KEYS.theme, next);
    sync();
    setTimeout(() => root.classList.remove("theme-anim"), 450);
  });
  sync();
}
