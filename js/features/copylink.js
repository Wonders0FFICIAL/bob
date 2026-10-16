import { $ } from "../dom.js";

export function initCopyLink() {
  const btn = $("copycam");
  if (!btn) return;
  const url = "https://bob.jrofficial.org/#camera";
  btn.addEventListener("click", async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {}
    btn.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
  });
}
