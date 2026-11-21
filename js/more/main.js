import { initTheme } from "../features/theme.js";
import { CHANNELS } from "./config.js";

const $ = (id) => document.getElementById(id);

initTheme();

const toggle = $("pcToggle");
const panel = $("pcPanel");
const list = $("pcList");
const locked = $("pcLocked");
const ready = CHANNELS.filter((c) => c.phone && c.laptop);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function codeRow(label, value) {
  const row = el("div", "mo-pc-row");
  const name = el("span", "mo-pc-role", label);
  const out = el("code", "mo-code", value);
  const copy = el("button", "mo-pc-copy", "Copy");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select and copy";
    }
    setTimeout(() => { copy.textContent = "Copy"; }, 1800);
  });
  row.append(name, out, copy);
  return row;
}

function build() {
  list.textContent = "";
  for (const c of ready) {
    const card = el("div", "mo-ch");
    card.append(el("h4", "mo-ch-name", c.name), codeRow("Phone", c.phone), codeRow("Laptop", c.laptop));
    list.append(card);
  }
}

locked.hidden = ready.length > 0;
list.hidden = ready.length === 0;

toggle.addEventListener("click", () => {
  const open = panel.hidden;
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Hide passcodes" : "View passcodes";
  if (open && ready.length) build();
  if (!open) list.textContent = "";
});

const reveal = [...document.querySelectorAll("[data-reveal]")];
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  for (const el of reveal) { el.classList.add("pre"); io.observe(el); }
}
