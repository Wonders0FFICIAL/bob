import { W, H } from "./worlds.js";
import { PIP_RANGE, BOB_SENSE, temperature } from "./sim.js";
import { drawLying, LOOKS } from "../features/person.js";
import { paletteById } from "../features/thermal.js";

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function decor(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const r = rng(def.seed * 977);
  const specks = Array.from({ length: 260 }, () => [r() * W, r() * H, 0.6 + r() * 1.8]);
  const cracks = [];
  if (def.id === "earthquake") {
    for (let i = 0; i < 16; i++) {
      let x = r() * W, y = r() * H, a = r() * 6.28;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * (18 + r() * 24); y += Math.sin(a) * (18 + r() * 24); pts.push([x, y]); }
      cracks.push(pts);
    }
  }
  const pileShapes = def.piles.map(([px, py, pr]) => {
    const n = 7 + Math.floor(r() * 4);
    return Array.from({ length: n }, () => {
      const a = r() * 6.28, d = r() * pr * 0.7, sz = pr * (0.28 + r() * 0.34), sides = 4 + Math.floor(r() * 3);
      return { x: px + Math.cos(a) * d, y: py + Math.sin(a) * d, sz, rot: r() * 6.28, sides, c: Math.floor(r() * 4), jig: Array.from({ length: sides }, () => 0.75 + r() * 0.35) };
    });
  });
  const slabCracks = def.blocks.map(() => Array.from({ length: 2 + Math.floor(r() * 3) }, () => [r(), r(), (r() - 0.5) * 40, (r() - 0.5) * 40]));
  const rebar = def.id === "earthquake" ? def.blocks.flatMap((b) => Array.from({ length: 3 }, () => ({ x: b.x + r() * b.w, y: b.y + (r() < 0.5 ? 0 : b.h), a: r() * 3.14 - 0.4, l: 8 + r() * 12 }))) : [];
  const dust = Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 2.4, v: 0.15 + r() * 0.45, ph: r() * 6.28 }));
  const d = { specks, cracks, pileShapes, slabCracks, rebar, dust };
  cache.set(def.id, d);
  return d;
}

function pill(ctx, x, y, text, bg, fg, size = 11) {
  ctx.font = "bold " + size + "px sans-serif";
  const w = ctx.measureText(text).width + 14, h = size + 9;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5);
  ctx.textBaseline = "alphabetic";
}

function poly(ctx, x, y, sz, rot, sides, jig) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i / sides * 6.283, rr = sz * jig[i];
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function flame(ctx, x, y, h, w, ph, t, calm) {
  const sway = calm ? 0 : Math.sin(t / 6 + ph) * w * 0.3, hh = h * (1 + (calm ? 0 : Math.sin(t / 4 + ph) * 0.14));
  const g = ctx.createLinearGradient(0, y, 0, y - hh);
  g.addColorStop(0, "#E5322D"); g.addColorStop(0.45, "#FF8A1F"); g.addColorStop(1, "rgba(255,232,130,.92)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 1.1, y - hh * 0.5, x + sway, y - hh);
  ctx.quadraticCurveTo(x + w * 1.1, y - hh * 0.5, x + w, y);
  ctx.closePath(); ctx.fill();
}

function drawWorld(ctx, sim, t, calm) {
  const def = sim.def, pal = def.palette, d = decor(def);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal.sky[0]); sky.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const gr = ctx.createRadialGradient(W * 0.55, H * 0.5, 60, W * 0.55, H * 0.5, 620);
  gr.addColorStop(0, pal.ground); gr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.85; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  ctx.fillStyle = pal.speck;
  for (const [x, y, s] of d.specks) ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
  for (const c of d.cracks) { ctx.beginPath(); c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }

  const z = def.zone;
  ctx.save(); ctx.strokeStyle = pal.zone; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
  ctx.strokeRect(z.x - 8, z.y - 8, z.w + 16, z.h + 16); ctx.restore();
  pill(ctx, z.x + 74, z.y - 22, def.zone.label, "rgba(0,0,0,.45)", pal.zone, 10);

  for (const b of def.blocks) { ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h); }
  for (const [x, y, r] of def.piles) { ctx.fillStyle = "rgba(0,0,0,.34)"; ctx.beginPath(); ctx.ellipse(x + 4, y + 7, r * 1.1, r * 0.9, 0, 0, 7); ctx.fill(); }

  def.blocks.forEach((b, i) => {
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, pal.slab[0]); g.addColorStop(0.6, pal.slab[1]); g.addColorStop(1, pal.slab[2]);
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(b.x, b.y, b.w, Math.min(5, b.h));
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    if (def.id === "fire") { ctx.strokeStyle = "rgba(255,110,60,.28)"; ctx.lineWidth = 1; ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6); }
    if (def.id !== "fire" && b.w > 40 && b.h > 40) {
      ctx.strokeStyle = "rgba(0,0,0,.42)"; ctx.lineWidth = 1.4;
      for (const [fx, fy, dx, dy] of d.slabCracks[i]) {
        const cx = b.x + fx * b.w, cy = b.y + fy * b.h;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(Math.max(b.x, Math.min(b.x + b.w, cx + dx)), Math.max(b.y, Math.min(b.y + b.h, cy + dy))); ctx.stroke();
      }
    }
  });
  ctx.strokeStyle = "#B4552D"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  for (const r of d.rebar) { ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(r.a) * r.l, r.y + Math.sin(r.a) * r.l - 3); ctx.stroke(); }
  ctx.lineCap = "butt";
  if (def.id === "tunnel") {
    ctx.fillStyle = "rgba(255,245,200,.7)";
    for (let x = 60; x < W; x += 90) { ctx.fillRect(x, 231, 26, 3); ctx.fillRect(x, 366, 26, 3); }
  }

  for (const shapes of d.pileShapes) {
    for (const s of shapes) {
      ctx.fillStyle = pal.pile[s.c]; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.2;
      poly(ctx, s.x, s.y, s.sz, s.rot, s.sides, s.jig); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.14)"; poly(ctx, s.x - s.sz * 0.15, s.y - s.sz * 0.2, s.sz * 0.5, s.rot, s.sides, s.jig); ctx.fill();
    }
  }

  for (const f of def.fires) {
    const gl = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r * 3);
    gl.addColorStop(0, "rgba(255,170,60,.62)"); gl.addColorStop(0.5, "rgba(255,90,30,.2)"); gl.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#3A1208"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.9, 0, 7); ctx.fill();
    flame(ctx, f.x - f.r * 0.45, f.y + f.r * 0.5, f.r * 1.4, f.r * 0.36, f.x, t, calm);
    flame(ctx, f.x + f.r * 0.45, f.y + f.r * 0.5, f.r * 1.2, f.r * 0.34, f.x + 2, t, calm);
    flame(ctx, f.x, f.y + f.r * 0.55, f.r * 1.9, f.r * 0.5, f.x + 4, t, calm);
  }
}

function drawAmbient(ctx, sim, t, calm) {
  const d = decor(sim.def), h = sim.def.hazards;
  if (h === "smoke") {
    for (let k = 0; k < 22; k++) {
      const u = ((t * 0.5 + k * 41) % 260) / 260, f = sim.def.fires[k % sim.def.fires.length];
      const x = f.x + Math.sin(k * 3 + u * 4) * 34 + u * 30, y = f.y - u * 130;
      ctx.fillStyle = "rgba(70,60,62," + (0.34 * (1 - u)) + ")";
      ctx.beginPath(); ctx.arc(x, y, 14 + u * 36, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "rgba(60,48,50,.2)"; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = sim.def.id === "tunnel" ? "rgba(170,210,235,.35)" : "rgba(235,200,150,.34)";
    for (const p of d.dust) {
      const x = (p.x + (calm ? 0 : t * p.v)) % W, y = p.y + (calm ? 0 : Math.sin(t / 50 + p.ph) * 8);
      ctx.beginPath(); ctx.arc(x, y, p.s, 0, 7); ctx.fill();
    }
  }
}

function drawSurvivors(ctx, sim, t, calm) {
  const pal = sim.def.palette;
  for (const s of sim.survivors) {
    if (s.state === "unknown") continue;
    const look = LOOKS[s.look], ang = [0.3, -2.7, 2.2, -0.5][s.id % 4];
    if (s.state === "signal") {
      const pulse = calm ? 1 : 1 + Math.sin(t / 8 + s.id) * 0.18;
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 38 * pulse);
      g.addColorStop(0, "rgba(255,240,150,.95)"); g.addColorStop(0.35, "rgba(255,110,40,.6)"); g.addColorStop(0.7, "rgba(196,38,122,.3)"); g.addColorStop(1, "rgba(120,30,140,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 38 * pulse, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.5; drawLying(ctx, s.x, s.y, 1.35, ang, look, t, calm); ctx.globalAlpha = 1;
      pill(ctx, s.x, s.y - 44, "HEAT · " + (s.id + 1), "#E5322D", "#fff", 10);
    } else {
      ctx.strokeStyle = "rgba(60,220,130,.65)"; ctx.lineWidth = 2;
      const pr = 32 + (calm ? 0 : ((t + s.id * 17) % 60) / 4);
      ctx.beginPath(); ctx.arc(s.x, s.y, pr, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(30,158,90,.25)"; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, 7); ctx.fill();
      drawLying(ctx, s.x, s.y, 1.5, ang, look, t, calm);
      if (s.aided) {
        const k = Math.min(1, (sim.frame - (s.aidFrame || 0)) / 24), lift = (1 - k) * (1 - k) * 30;
        ctx.fillStyle = "#FF7A1F"; ctx.strokeStyle = "#1A0F06"; ctx.lineWidth = 1.5;
        ctx.fillRect(s.x + 22, s.y + 18 - lift, 11, 11); ctx.strokeRect(s.x + 22, s.y + 18 - lift, 11, 11);
        ctx.fillStyle = "#fff"; ctx.fillRect(s.x + 26.6, s.y + 19.6 - lift, 2, 8); ctx.fillRect(s.x + 23.6, s.y + 22.6 - lift, 8, 2);
      }
      ctx.strokeStyle = "#E8E8EA"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - 30, s.y + 22); ctx.lineTo(s.x - 30, s.y - 14); ctx.stroke();
      ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.moveTo(s.x - 30, s.y - 14); ctx.lineTo(s.x - 16, s.y - 9); ctx.lineTo(s.x - 30, s.y - 4); ctx.closePath(); ctx.fill();
      pill(ctx, s.x, s.y - 46, s.aided ? "SURVIVOR · AID SENT" : "SURVIVOR " + (s.id + 1), "#1E9E5A", "#fff", 10);
    }
  }
}

function drawBob(ctx, sim, t, calm) {
  const b = sim.bob;
  ctx.strokeStyle = "rgba(255,210,31,.14)"; ctx.lineWidth = 1;
  const sense = BOB_SENSE * (sim.def.hazards === "smoke" ? 0.7 : 1);
  ctx.beginPath(); ctx.arc(b.x, b.y, sense, 0, 7); ctx.stroke();
  if (sim.trail.length > 1) {
    ctx.strokeStyle = "rgba(255,210,31,.3)"; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath();
    sim.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
  }
  if (sim.target && sim.path.length) {
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(b.x, b.y);
    sim.path.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  const wid = 1 - 0.3 * b.squeeze, jig = calm ? 0 : Math.sin(t / 2) * 0.6 * b.squeeze;
  ctx.scale(1 + 0.08 * b.squeeze, wid);
  const lg = ctx.createLinearGradient(12, 0, 80, 0); lg.addColorStop(0, "rgba(255,248,220,.34)"); lg.addColorStop(1, "rgba(255,248,220,0)");
  ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(80, -30); ctx.lineTo(80, 30); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#0A0F12";
  for (const [wx, wy] of [[-12, -15], [8, -15], [-12, 10], [8, 10]]) ctx.fillRect(wx + jig, wy, 11, 5);
  ctx.fillStyle = "#30363B"; ctx.strokeStyle = "#FF5A14"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.roundRect(-17, -10, 34, 20, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#FF5A14"; ctx.fillRect(-14, -8, 5, 16);
  ctx.fillStyle = "#FFD21F"; ctx.beginPath(); ctx.arc(12, 0, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = sim.pip || !sim.pipOn ? "#1B2328" : "#59D2FF"; ctx.fillRect(-8, -5, 12, 10);
  ctx.restore();
  pill(ctx, b.x, b.y - 28, sim.squeezed ? "BOB · SQUEEZING" : "BOB", sim.squeezed ? "rgba(255,138,31,.95)" : "rgba(255,210,31,.92)", "#1A1405", 10);
}

function drawPip(ctx, sim) {
  const p = sim.pip;
  if (!p) return;
  const trail = sim.pipTrail || [];
  if (trail.length > 1) {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(89,210,255,.07)"; ctx.lineWidth = PIP_RANGE * 1.7; ctx.beginPath();
    trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    ctx.strokeStyle = "rgba(89,210,255,.4)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.beginPath();
    trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = "rgba(89,210,255,.55)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(p.x, p.y, PIP_RANGE, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "rgba(0,0,0,.34)"; ctx.beginPath(); ctx.ellipse(p.x + 8, p.y + 13, 14, 6, 0, 0, 7); ctx.fill();
  for (let k = 0; k < 4; k++) {
    const ax = p.x + (k % 2 ? 11 : -11), ay = p.y + (k < 2 ? -11 : 11), sp = p.spin;
    ctx.fillStyle = "rgba(255,90,20,.18)"; ctx.beginPath(); ctx.arc(ax, ay, 8.5, 0, 7); ctx.fill();
    ctx.strokeStyle = "#FF5A14"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, 8.5, 0, 7); ctx.stroke();
    ctx.strokeStyle = "rgba(235,242,247,.9)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ax + Math.cos(sp + k) * 7, ay + Math.sin(sp + k) * 7); ctx.lineTo(ax - Math.cos(sp + k) * 7, ay - Math.sin(sp + k) * 7); ctx.stroke();
  }
  ctx.fillStyle = "#2A3035"; ctx.strokeStyle = "#0D1C26"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(p.x - 7, p.y - 6, 14, 12, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#59D2FF"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 7); ctx.fill();
  pill(ctx, p.x, p.y - 30, "PIP", "rgba(89,210,255,.92)", "#06232E", 10);
}

function drawThermalInset(ctx, sim, t, calm, paletteId) {
  const p = sim.pip, w = 250, h = 188, x0 = W - w - 16, y0 = H - h - 44, Z = 2.2, col = paletteById(paletteId).colour;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 12); ctx.clip();
  ctx.fillStyle = col(0.04); ctx.fillRect(x0, y0, w, h);
  ctx.translate(x0 + w / 2, y0 + h / 2); ctx.scale(Z, Z); ctx.translate(-p.x, -p.y);
  ctx.fillStyle = col(0.22);
  for (const b of sim.def.blocks) ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = col(0.27);
  for (const [px, py, pr] of sim.def.piles) { ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill(); }
  const blob = (x, y, r, v) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, col(v)); g.addColorStop(0.55, col(v * 0.62)); g.addColorStop(1, col(0, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  };
  for (const f of sim.def.fires) blob(f.x, f.y, f.r * 1.9, 1);
  blob(sim.bob.x, sim.bob.y, 22, 0.5);
  for (const s of sim.survivors) if (Math.hypot(s.x - p.x, s.y - p.y) < PIP_RANGE * 1.15) blob(s.x, s.y, 20, 0.86);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.2;
  const cx = x0 + w / 2, cy = y0 + h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 26, cy); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 8); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 26); ctx.stroke();
  ctx.strokeStyle = "rgba(142,163,178,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 12); ctx.stroke();
  pill(ctx, x0 + 62, y0 + 16, "PIP THERMAL", "rgba(5,11,16,.7)", "#9BE4FF", 10);
  ctx.fillStyle = "rgba(229,50,45," + (calm || Math.floor(t / 30) % 2 ? 1 : 0.2) + ")"; ctx.beginPath(); ctx.arc(x0 + w - 18, y0 + 16, 4, 0, 7); ctx.fill();
}

function chips(ctx, sim) {
  const found = sim.survivors.filter((s) => s.state !== "unknown").length, reached = sim.survivors.filter((s) => s.reached).length, aided = sim.survivors.filter((s) => s.aided).length;
  const n = sim.survivors.length, temp = Math.round(temperature(sim, sim.bob));
  const items = [
    ["SIGNALS", found + "/" + n, found ? "#FF8A1F" : "rgba(255,255,255,.18)"],
    ["REACHED", reached + "/" + n, reached ? "#1E9E5A" : "rgba(255,255,255,.18)"],
    ["AID", aided + "/" + n, aided ? "#59D2FF" : "rgba(255,255,255,.18)"],
  ];
  if (sim.def.fires.length) items.push(["TEMP", temp + "°C", temp > 80 ? "#E5322D" : "rgba(255,255,255,.18)"]);
  let x = 14;
  for (const [k, v, c] of items) {
    ctx.font = "bold 11px sans-serif";
    const w = ctx.measureText(k + "  " + v).width + 26;
    ctx.fillStyle = "rgba(5,11,16,.74)"; ctx.beginPath(); ctx.roundRect(x, 12, w, 25, 12.5); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 13, 24.5, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#E6EDF2"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(k + "  " + v, x + 23, 25);
    ctx.textBaseline = "alphabetic"; x += w + 7;
  }
  ctx.textAlign = "center";
}

export function draw(ctx, sim, ui) {
  const calm = ui.calm, t = calm ? 0 : sim.frame;
  ctx.setTransform(ui.scale, 0, 0, ui.scale, 0, 0);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineCap = "butt"; ctx.setLineDash([]);
  if (sim.pip && sim.frame % 3 === 0) { sim.pipTrail = sim.pipTrail || []; sim.pipTrail.push({ x: sim.pip.x, y: sim.pip.y }); if (sim.pipTrail.length > 260) sim.pipTrail.shift(); }
  if (!sim.pip && sim.pipTrail && sim.pipTrail.length) sim.pipTrail.splice(0, 2);
  drawWorld(ctx, sim, t, calm);
  drawSurvivors(ctx, sim, t, calm);
  drawAmbient(ctx, sim, t, calm);
  drawBob(ctx, sim, t, calm);
  drawPip(ctx, sim);
  const vg = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 640);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  chips(ctx, sim);
  const bx = sim.def.base.x, by = sim.def.base.y;
  ctx.strokeStyle = "#8EA3B2"; ctx.lineWidth = 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(bx + sx * 24, by + sy * 10); ctx.lineTo(bx + sx * 24, by + sy * 24); ctx.lineTo(bx + sx * 10, by + sy * 24); ctx.stroke(); }
  pill(ctx, bx, by + 38, "BASE", "rgba(142,163,178,.28)", "#D6E0E7", 10);
  if (sim.pip && ui.inset) drawThermalInset(ctx, sim, t, calm, ui.palette);
  ui.banners = ui.banners.filter((b) => ui.frame - b.born < 200);
  ui.banners.slice(-2).reverse().forEach((b, i) => {
    const age = ui.frame - b.born, a = Math.min(1, age / 10, (200 - age) / 26), rise = calm ? 0 : (1 - Math.min(1, age / 12)) * 14;
    const cols = { alert: ["#E5322D", "#fff"], ok: ["#1E9E5A", "#fff"], aid: ["#FF7A1F", "#1A0F06"], info: ["#2E86AB", "#fff"] }[b.kind] || ["#2E86AB", "#fff"];
    ctx.save(); ctx.globalAlpha = Math.max(0, a) * (i ? 0.8 : 1);
    pill(ctx, W / 2, 84 + i * 50 - rise, b.text, cols[0], cols[1], i ? 22 : 30);
    ctx.restore();
  });
  const status = sim.finished ? "MISSION COMPLETE" : sim.auto ? "AUTO" : sim.manual ? "MANUAL" : sim.target ? "MOVING" : "READY";
  ctx.fillStyle = "rgba(5,11,16,.9)"; ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = "#E6EDF2"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
  const secs = Math.floor(sim.frame / 60), mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  ctx.fillText("BOB " + Math.round(sim.battery) + "%    " + (sim.pipOn ? "PIP " + (sim.pip ? Math.round(sim.pipBat) + "%" : "DOCKED") : "PIP OFF") + "    " + status + "    T+" + mm + ":" + ss, 14, H - 10);
  ctx.textAlign = "center";
}
