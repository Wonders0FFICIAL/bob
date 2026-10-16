export function initLens() {
  const lens = document.querySelector(".lens");
  if (!lens) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mx = null, my = null;
  let px = 0, py = 0;
  let hx = 0.707, hy = 0.707;
  let raf = 0;

  function frame() {
    raf = 0;
    const r = lens.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let tpx = 0, tpy = 0, thx = 0.707, thy = 0.707;
    if (mx !== null) {
      const dx = mx - cx, dy = my - cy;
      const d = Math.hypot(dx, dy) || 1;
      thx = dx / d; thy = dy / d;
    }
    const k = calm ? 1 : 0.18;
    px += (tpx - px) * k; py += (tpy - py) * k;
    hx += (thx - hx) * k; hy += (thy - hy) * k;
    lens.style.setProperty("--px", px.toFixed(2) + "px");
    lens.style.setProperty("--py", py.toFixed(2) + "px");
    lens.style.setProperty("--hx", hx.toFixed(3));
    lens.style.setProperty("--hy", hy.toFixed(3));
    const moving = Math.abs(tpx - px) > 0.05 || Math.abs(tpy - py) > 0.05 ||
                   Math.abs(thx - hx) > 0.005 || Math.abs(thy - hy) > 0.005;
    if (moving) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; wake(); }, { passive: true });
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  document.documentElement.addEventListener("mouseleave", () => { mx = my = null; wake(); });
}
