// Interface bits that are not 3D: live meters, the minimap, the hardware panel, settings and the mixer.
// main.js passes in callbacks (what to do) and calls update() every frame with the current state (what is happening).
export function createUI(cb) {
  const $ = id => document.getElementById(id);
  const mm = $('mmc'), mx = mm.getContext('2d');
  const KEY = 'bob_sim_settings';
  let S = { q: 'med', shadows: true, fx: true, shake: true, map: true, vol: { master: 0.8, motor: 1, terrain: 1, pip: 1, fx: 1, alert: 1 } };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { S = Object.assign(S, o); S.vol = Object.assign({ master: 0.8, motor: 1, terrain: 1, pip: 1, fx: 1, alert: 1 }, o.vol || {}); } } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

  // ---------- settings wiring
  const seg = (id, key, fn) => {
    const el = $(id); if (!el) return;
    el.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', String(S[key]) === b.dataset.v);
      b.onclick = () => { S[key] = b.dataset.v; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); save(); fn(S[key]); };
    });
  };
  const tog = (id, key, fn) => {
    const b = $(id); if (!b) return;
    const paint = () => { b.classList.toggle('on', !!S[key]); b.textContent = S[key] ? 'On' : 'Off'; };
    paint(); b.onclick = () => { S[key] = !S[key]; paint(); save(); fn(S[key]); };
  };
  seg('set_q', 'q', v => cb.quality(v));
  tog('set_sh', 'shadows', v => cb.shadows(v));
  tog('set_fx', 'fx', v => cb.fx(v));
  tog('set_ck', 'shake', v => cb.shake(v));
  tog('set_mm', 'map', v => { $('mm').hidden = !v; });
  for (const k of ['master', 'motor', 'terrain', 'pip', 'fx', 'alert']) {
    const r = $('mx_' + k); if (!r) continue;
    r.value = Math.round(S.vol[k] * 100);
    r.oninput = () => { S.vol[k] = r.value / 100; $('mxv_' + k).textContent = r.value + '%'; cb.vol(k, S.vol[k]); };
    r.onchange = save;
    $('mxv_' + k).textContent = r.value + '%';
  }
  document.querySelectorAll('[data-snd]').forEach(b => { b.onclick = () => cb.sound(b.dataset.snd); });
  $('mm').hidden = !S.map;
  const hwReal = $('hw_real'); if (hwReal) hwReal.onclick = () => cb.realParts();
  const hwStd = $('hw_std'); if (hwStd) hwStd.onclick = () => cb.designParts();
  // apply the saved settings once the scene exists
  function applySaved() {
    cb.quality(S.q); cb.shadows(S.shadows); cb.fx(S.fx); cb.shake(S.shake);
    for (const k in S.vol) cb.vol(k, S.vol[k]);
  }

  // ---------- meters
  const level = (id, v, warnBelow, badBelow) => {
    const e = $(id); if (!e) return;
    v = Math.max(0, Math.min(1, v)); e.style.width = Math.round(v * 100) + '%';
    e.className = warnBelow != null ? (v < badBelow ? 'bad' : v < warnBelow ? 'warn' : '') : (v > 0.85 ? 'bad' : v > 0.6 ? 'warn' : '');
  };

  // ---------- minimap
  let mt = 0;
  const trail = []; let trailT = 0;
  function drawMap(f) {
    const A = f.arena, W = mm.width, H = mm.height, pad = 6;
    const sc = Math.min((W - pad * 2) / (A.x_max - A.x_min), (H - pad * 2) / (2 * A.y_half));
    const px = x => pad + (x - A.x_min) * sc, py = y => H / 2 - y * sc;
    mx.clearRect(0, 0, W, H);
    mx.fillStyle = 'rgba(255,255,255,.05)'; mx.fillRect(px(A.x_min), py(A.y_half), (A.x_max - A.x_min) * sc, 2 * A.y_half * sc);
    mx.strokeStyle = 'rgba(255,255,255,.28)'; mx.lineWidth = 2; mx.strokeRect(px(A.x_min), py(A.y_half), (A.x_max - A.x_min) * sc, 2 * A.y_half * sc);
    // ramp and platform
    mx.fillStyle = 'rgba(255,138,31,.16)'; mx.fillRect(px(A.ramp.x0), py(A.ramp.half_w), (A.ramp.x1 - A.ramp.x0) * sc, 2 * A.ramp.half_w * sc);
    mx.fillStyle = 'rgba(255,255,255,.10)'; mx.fillRect(px(A.ramp.x1), py(A.platform.half_w), (A.platform.x_end - A.ramp.x1) * sc, 2 * A.platform.half_w * sc);
    mx.fillStyle = 'rgba(53,240,200,.7)'; const dz = A.drop_zone; mx.fillRect(px(dz.x - dz.size / 2), py(dz.y + dz.size / 2), dz.size * sc, dz.size * sc);
    // logs, blocks, barrels
    mx.strokeStyle = 'rgba(160,110,60,.9)'; mx.lineWidth = 2;
    for (const l of A.logs) { mx.beginPath(); mx.moveTo(px(l.x), py(l.y0)); mx.lineTo(px(l.x), py(l.y1)); mx.stroke(); }
    mx.fillStyle = 'rgba(190,195,205,.45)'; for (const b of A.boxes) mx.fillRect(px(b.x0), py(b.y1), (b.x1 - b.x0) * sc, (b.y1 - b.y0) * sc);
    mx.fillStyle = 'rgba(90,140,255,.8)'; for (const b of f.barrels) { mx.beginPath(); mx.arc(px(b[0]), py(b[1]), 150 * sc, 0, 6.3); mx.fill(); }
    for (const c of f.cones) { mx.fillStyle = c[2] > 0.6 ? 'rgba(255,190,120,.45)' : '#ff7a1a'; mx.beginPath(); mx.arc(px(c[0]), py(c[1]), c[2] > 0.6 ? 2.6 : 3.4, 0, 6.3); mx.fill(); }
    // casualty: only once found (or in demo mode)
    if (f.showVictim) {
      const pulse = 5 + 2 * Math.sin(f.t * 5);
      mx.strokeStyle = '#ff5a1a'; mx.lineWidth = 2; mx.beginPath(); mx.arc(px(f.victim.x), py(f.victim.y), pulse, 0, 6.3); mx.stroke();
      mx.fillStyle = '#ff5a1a'; mx.beginPath(); mx.arc(px(f.victim.x), py(f.victim.y), 2.4, 0, 6.3); mx.fill();
    }
    // trail, Bob (arrow with sensor cone), Pip
    if (trail.length > 1) { mx.strokeStyle = 'rgba(53,208,196,.5)'; mx.lineWidth = 1.5; mx.beginPath(); trail.forEach((p, i) => { const X = px(p[0]), Y = py(p[1]); i ? mx.lineTo(X, Y) : mx.moveTo(X, Y); }); mx.stroke(); }
    const bx = px(f.bob.x), by = py(f.bob.y), a = -f.bob.psi;
    mx.save(); mx.translate(bx, by); mx.rotate(a);
    mx.fillStyle = 'rgba(53,208,196,.16)'; mx.beginPath(); mx.moveTo(0, 0); mx.arc(0, 0, 2000 * sc * 0.55, -0.35, 0.35); mx.closePath(); mx.fill();
    mx.fillStyle = '#35d0c4'; mx.beginPath(); mx.moveTo(8, 0); mx.lineTo(-6, 5); mx.lineTo(-3, 0); mx.lineTo(-6, -5); mx.closePath(); mx.fill();
    mx.restore();
    if (f.pip) { const X = px(f.pip.x), Y = py(f.pip.y); mx.strokeStyle = '#ffd24a'; mx.lineWidth = 2; mx.beginPath(); mx.moveTo(X - 5, Y); mx.lineTo(X + 5, Y); mx.moveTo(X, Y - 5); mx.lineTo(X, Y + 5); mx.stroke(); mx.beginPath(); mx.arc(X, Y, 4, 0, 6.3); mx.stroke(); }
  }

  // ---------- per-frame update
  function update(f) {
    if (!f.play) return;
    const ps = f.ps;
    level('mt_bt', ps.soc, 0.35, 0.15);
    level('mt_ld', ps.load || 0);
    level('mt_sl', ps.slip || 0);
    level('mt_dm', ps.dmg / 100);
    const sp = $('h_sp'); if (sp) { const v = ps.bob.speed / 1000; $('spdbar').style.width = Math.min(100, v / (f.vmax / 1000) * 100) + '%'; }
    // hardware panel (only while it is open)
    const hw = $('hw');
    if (hw && hw.style.display === 'block') {
      const st = f.ext.on ? f.ext.state : 'KEYBOARD';
      const chip = $('hw_state'); chip.textContent = st; chip.className = 'chip ' + ({ ARMED: 'ok', READY: 'info', SAFE: 'mute', STOP: 'bad', KEYBOARD: 'info' }[st] || 'mute');
      $('hw_dl').style.width = Math.round(Math.abs(ps.uL) * 100) + '%'; $('hw_dr').style.width = Math.round(Math.abs(ps.uR) * 100) + '%';
      $('hw_dlv').textContent = (ps.uL * 100 | 0) + '%'; $('hw_drv').textContent = (ps.uR * 100 | 0) + '%';
      $('hw_a').textContent = ps.cur.toFixed(1) + ' A';
      $('hw_v').textContent = ps.volts.toFixed(1) + ' V';
      const pi = $('hw_pi'); pi.textContent = f.feeds ? 'Streaming (sim)' : 'Idle'; pi.className = 'chip ' + (f.feeds ? 'ok' : 'mute');
      const dot = (id, x, y) => { const e = $(id); e.style.left = (50 + x * 38) + '%'; e.style.top = (50 - y * 38) + '%'; };
      const fw = (ps.uL + ps.uR) / 2, tr = (ps.uR - ps.uL) / 2 / 0.55;
      dot('fs_r', Math.max(-1, Math.min(1, tr)), fw);
      const ip = ps.inpP || [0, 0, 0, 0];
      dot('fs_l', ip[0], ip[1]);
    }
    mt -= f.dt;
    if (mt <= 0) {
      mt = 1 / 12;
      trailT -= 1 / 12;
      if (trailT <= 0) { trailT = 0.25; trail.push([f.bob.x, f.bob.y]); if (trail.length > 240) trail.shift(); }
      if (!$('mm').hidden) drawMap(f);
    }
  }
  function clearTrail() { trail.length = 0; }
  return { update, clearTrail, applySaved, settings: () => S };
}
