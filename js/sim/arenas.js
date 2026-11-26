// Arena layouts (classic, cone slalom, rubble yard, random) plus the floor paint for each.
// A layout is plain data; main.js turns it into meshes and collision shapes.
const THREE = window.THREE;

export const KINDS = [
  ['classic', 'Classic', 'The original course: two logs, three blocks, barrels, and the ramp.'],
  ['slalom', 'Cone slalom', 'Weave through the cone gates without knocking one over, then find the casualty.'],
  ['rubble', 'Rubble yard', 'Logs, uneven blocks and fallen slabs. Hard on the suspension.'],
  ['random', 'Random', 'A new layout from a seed number. Same seed, same arena.'],
];

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CLASSIC_CONES = [[300, -1000], [300, 1000], [1500, -1250], [2500, 1150], [3000, -1100], [3700, -1250], [4400, -1100], [4400, 1100]];
const COL_A = 0x2d6cdf, COL_B = 0xc23b3b;

export function makeLayout(kind, seed, base) {
  const r = mulberry((seed | 0) * 7919 + 13 + kind.length * 101), R = (a, b) => a + (b - a) * r();
  if (kind === 'classic') {
    return {
      kind, theme: 'concrete',
      logs: JSON.parse(JSON.stringify(base.logs)), boxes: JSON.parse(JSON.stringify(base.boxes)),
      barrels: [[700, 1300, COL_A], [2000, -1250, COL_B], [2950, 1300, COL_A], [3600, -1400, COL_B], [5200, 1250, COL_A]],
      cones: CLASSIC_CONES.map(p => p.slice()),
      debris: [[3500, 1180, 110, 70, 60], [4040, 1230, 90, 130, 45], [3950, 640, 70, 60, 35], [3420, 760, 100, 80, 40]],
      victim: { x: base.victim.x, y: base.victim.y, rot: 0.5 },
    };
  }
  const L = { kind, theme: 'concrete', logs: [], boxes: [], barrels: [], cones: [], debris: [] };
  const side = r() < 0.5 ? -1 : 1;

  if (kind === 'slalom') {
    L.theme = 'asphalt';
    const n = 8, gw = 330, x0 = 700, dx = 400;
    L.lane = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * dx, yc = 430 * Math.sin(i * 0.95 + R(-0.15, 0.15)) * (i === 0 ? 0.4 : 1);
      L.lane.push([x, yc]);
      L.cones.push([x, yc - gw], [x, yc + gw]);
    }
    // start gate and finish gate
    L.cones.push([-150, -300], [-150, 300]);
    const last = L.lane[n - 1];
    L.cones.push([last[0] + 380, last[1] - gw], [last[0] + 380, last[1] + gw]);
    L.lane.push([last[0] + 380, last[1]]);
    // two low bumps inside the course
    for (const i of [2, 5]) { const p = L.lane[i]; L.boxes.push({ x0: p[0] + 120, x1: p[0] + 190, y0: p[1] - 280, y1: p[1] + 280, h: 22 }); }
    // barrels as side walls, a few cones marking the road edge
    for (const [x, y] of [[900, 1250], [1700, -1300], [2500, 1250], [3300, -1300], [4200, 1300]]) L.barrels.push([x, y, L.barrels.length % 2 ? COL_B : COL_A]);
    L.victim = { x: last[0] + 700, y: side * R(780, 1050), rot: R(0, 6.28) };
    for (let i = 0; i < 3; i++) { const a = R(0, 6.28), d = R(280, 480); L.debris.push([L.victim.x + Math.cos(a) * d, L.victim.y + Math.sin(a) * d, R(60, 110), R(60, 110), R(30, 50)]); }
    return L;
  }

  if (kind === 'rubble') {
    L.theme = 'dust';
    let px = -999;
    for (let i = 0; i < 4; i++) {
      let x = R(800, 3200); for (let k = 0; k < 30 && Math.abs(x - px) < 300; k++) x = R(800, 3200);
      px = x;
      const a = R(-950, -300), b = R(300, 950);
      L.logs.push({ x, r: R(22, 44), y0: i % 2 ? a : -950, y1: i % 2 ? 950 : b });
    }
    L.logs.sort((p, q) => p.x - q.x);
    for (let i = 0; i < 8; i++) {
      const w = R(160, 300), d = R(180, 360), x0 = R(1000, 3500), cy = R(-900, 900);
      L.boxes.push({ x0, x1: x0 + w, y0: cy - d / 2, y1: cy + d / 2, h: R(20, 56) });
    }
    L.victim = { x: R(3500, 4000), y: side * R(600, 1000), rot: R(0, 6.28) };
    for (let i = 0; i < 9; i++) { const a = R(0, 6.28), d = R(250, 650); L.debris.push([L.victim.x + Math.cos(a) * d, L.victim.y + Math.sin(a) * d, R(70, 160), R(70, 160), R(30, 62)]); }
    let tries = 0;
    while (L.barrels.length < 4 && tries++ < 60) {
      const x = R(600, 5200), y = R(-1350, 1350);
      if (Math.abs(y) < 350 && x < 4200) continue;
      if (x > 4150 && Math.abs(y) < 950) continue;
      if (Math.hypot(x - L.victim.x, y - L.victim.y) < 600) continue;
      if (L.barrels.some(b => Math.hypot(b[0] - x, b[1] - y) < 500)) continue;
      L.barrels.push([x, y, L.barrels.length % 2 ? COL_B : COL_A]);
    }
    for (let i = 0; i < 6; i++) {                              // a cordon of cones around the casualty
      const a = i / 6 * 6.283 + 0.3, d = 820;
      L.cones.push([L.victim.x + Math.cos(a) * d, L.victim.y + Math.sin(a) * d]);
    }
    return L;
  }

  // random
  const nl = 2 + (r() < 0.5 ? 1 : 0);
  let px = -999;
  for (let i = 0; i < nl; i++) {
    let x = R(900, 2900); for (let k = 0; k < 20 && Math.abs(x - px) < 280; k++) x = R(900, 2900);
    px = x;
    const sp = R(550, 900);
    L.logs.push({ x, r: R(24, 42), y0: -sp * R(0.8, 1.2), y1: sp * R(0.8, 1.2) });
  }
  const nb = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const w = R(180, 300), d = R(220, 380), x0 = R(1300, 3100), cy = R(-700, 700);
    L.boxes.push({ x0, x1: x0 + w, y0: cy - d / 2, y1: cy + d / 2, h: R(25, 48) });
  }
  L.victim = { x: R(3300, 4000), y: side * R(700, 1200), rot: R(0, 6.28) };
  const nbar = 4 + Math.floor(r() * 3);
  let tries = 0;
  while (L.barrels.length < nbar && tries++ < 60) {
    const x = R(600, 5200), y = R(-1350, 1350);
    if (Math.abs(y) < 350 && x < 4200) continue;
    if (x > 4150 && Math.abs(y) < 950) continue;
    if (x < 550 && Math.abs(y) < 550) continue;
    if (Math.hypot(x - L.victim.x, y - L.victim.y) < 500) continue;
    if (L.barrels.some(b => Math.hypot(b[0] - x, b[1] - y) < 450)) continue;
    L.barrels.push([x, y, L.barrels.length % 2 ? COL_B : COL_A]);
  }
  const nc = 6 + Math.floor(r() * 4);
  for (let i = 0; i < nc; i++) {
    const x = R(200, 4600), y = R(-1450, 1450);
    if (Math.abs(y) < 250 || (x > 4150 && Math.abs(y) < 950)) continue;
    L.cones.push([x, y]);
  }
  for (let i = 0; i < 4; i++) { const a = R(0, 6.28), d = R(260, 520); L.debris.push([L.victim.x + Math.cos(a) * d, L.victim.y + Math.sin(a) * d, R(60, 130), R(60, 130), R(30, 60)]); }
  return L;
}

// ---------- floor paint
export function floorTexture(theme) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const base = { concrete: '#2b3038', asphalt: '#22252a', dust: '#4a4036' }[theme] || '#2b3038';
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  const grain = { concrete: [40, 26], asphalt: [30, 30], dust: [64, 40] }[theme] || [40, 26];
  for (let i = 0; i < 6500; i++) {
    const v = grain[0] + Math.random() * grain[1] | 0;
    x.fillStyle = theme === 'dust' ? `rgba(${v + 22},${v + 10},${v - 6},.5)` : `rgba(${v},${v + 4},${v + 10},.5)`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  if (theme === 'dust') {                                 // cracks and stains
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      let px = Math.random() * 512, py = Math.random() * 512; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 8; k++) { px += (Math.random() - .5) * 70; py += (Math.random() - .3) * 60; x.lineTo(px, py); } x.stroke();
    }
    for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(20,14,8,.12)'; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 50, 0, 6.3); x.fill(); }
  } else if (theme === 'asphalt') {
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(Math.random() * 512, Math.random() * 512, 90 + Math.random() * 140, 3); }
  } else {
    x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = 1; x.beginPath(); x.moveTo(256, 0); x.lineTo(256, 512); x.moveTo(0, 256); x.lineTo(512, 256); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding;
  return t;
}

// transparent overlay: metre ruler along the near wall, lane paint, start and finish lines
export function decalTexture(L, base) {
  const S = 5;                                            // millimetres per pixel
  const W = Math.round((base.x_max - base.x_min) / S), H = Math.round(2 * base.y_half / S);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const px = X => (X - base.x_min) / S, py = Y => (base.y_half - Y) / S;   // plane is rotated so +Y is up in the image
  // ruler
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.fillStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; x.font = '600 15px system-ui,sans-serif'; x.textAlign = 'center';
  for (let m = 0; m * 1000 <= base.x_max; m++) {
    const X = m * 1000, y0 = py(-base.y_half + 20);
    x.beginPath(); x.moveTo(px(X), y0); x.lineTo(px(X), y0 - 22); x.stroke();
    x.fillText(m + ' m', px(X), y0 - 30);
  }
  // start box
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; x.setLineDash([14, 10]);
  x.strokeRect(px(-250), py(250), 500 / S, 500 / S); x.setLineDash([]);
  x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '700 18px system-ui,sans-serif'; x.fillText('START', px(0), py(0) + 6);
  if (L.lane) {
    // painted racing line through the gates
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.setLineDash([26, 22]); x.lineJoin = 'round';
    x.beginPath(); const pts = [[0, 0], ...L.lane];
    pts.forEach((p, i) => { const X = px(p[0]), Y = py(p[1]); if (i === 0) x.moveTo(X, Y); else x.lineTo(X, Y); });
    x.stroke(); x.setLineDash([]);
    // start and finish lines (checkered finish)
    const last = L.lane[L.lane.length - 1];
    for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) {
      x.fillStyle = (k + j) % 2 ? '#ffffff' : '#111'; x.fillRect(px(last[0]) - 9 + j * 9, py(last[1] + 340) + k * 13.6, 9, 13.6);
    }
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '700 18px system-ui,sans-serif'; x.fillText('FINISH', px(last[0]) - 40, py(last[1] - 380));
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8; t.encoding = THREE.sRGBEncoding;
  return t;
}
