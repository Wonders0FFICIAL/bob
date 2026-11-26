// BOB sound engine. Everything is synthesised (no audio files) and modelled on the real hardware:
//  - six brushed JGB37-520 gearmotors: a commutation whine that rises with speed, a gear whine and a growl under load
//  - tyres on the arena floor: a granular crackle that follows wheel speed, a low hull rumble, a squeal when slipping
//  - Pip's four ducted fans on brushless motors: blade-pass whine plus air noise, pitch follows thrust
//  - MG90S servos for the cargo flap and Pip's latches
//  - a piezo buzzer (2.7 kHz) for the low-battery alarm, a relay click for the e-stop, STM32 arm tones
// Sources are placed in a stereo field and pass through a small hall reverb (the arena is a big room).

export function createAudio() {
  const A = { ctx: null, on: true, vol: { master: 0.8, motor: 1, terrain: 1, pip: 1, fx: 1, alert: 1 } };
  let nb = null, crackle = null, T = {}, bus = {}, last = {};

  function mkNoise(C) {
    const b = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function mkCrackle(C) {                       // sparse clicks of varying size: gravel and dust under the tyres
    const len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0);
    let i = 0;
    while (i < len) {
      const amp = Math.pow(Math.random(), 2.2), n = 8 + Math.floor(Math.random() * 40);
      for (let k = 0; k < n && i + k < len; k++) d[i + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / (n * 0.35));
      i += Math.floor(40 + Math.random() * 520);
    }
    return b;
  }
  function mkReverb(C) {
    const T_ = 1.5, len = Math.floor(C.sampleRate * T_), b = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, e = Math.pow(1 - t, 3.2);
        lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.4 * t);     // darker as it decays
        d[i] = lp * e * (i < 400 ? i / 400 : 1);
      }
    }
    return b;
  }
  const pan = (C, v) => { if (!C.createStereoPanner) return null; const p = C.createStereoPanner(); p.pan.value = v || 0; return p; };

  A.init = function () {
    if (A.ctx || !A.on) return;
    try {
      const C = new (window.AudioContext || window.webkitAudioContext)();
      A.ctx = C;
      const master = C.createGain(), comp = C.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      const wet = C.createGain(), conv = C.createConvolver();
      conv.buffer = mkReverb(C); wet.gain.value = 0.17;
      master.connect(comp); master.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(C.destination);
      A.master = master;
      for (const k of ['motor', 'terrain', 'pip', 'fx', 'alert']) { bus[k] = C.createGain(); bus[k].connect(master); }
      nb = mkNoise(C); crackle = mkCrackle(C);
      const src = (buf, rate) => { const s = C.createBufferSource(); s.buffer = buf; s.loop = true; if (rate) s.playbackRate.value = rate; s.start(); return s; };
      const out = (node, b, p) => { const g = C.createGain(); g.gain.value = 0; node.connect(g); const pn = pan(C, p); if (pn) { g.connect(pn); pn.connect(bus[b]); } else g.connect(bus[b]); return { g, pn }; };

      // --- the two sides of the drivetrain (three motors each)
      T.side = [-0.4, 0.4].map(p => {
        const o1 = C.createOscillator(), o2 = C.createOscillator(), o3 = C.createOscillator();
        o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle';
        const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.value = 500;
        const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        const mix = C.createGain(); mix.gain.value = 1;
        const g1 = C.createGain(), g2 = C.createGain(), g3 = C.createGain(); g1.gain.value = 0.55; g2.gain.value = 0.16; g3.gain.value = 0.7;
        o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(bp); g2.connect(bp); g3.connect(lp); bp.connect(mix); lp.connect(mix);
        o1.start(); o2.start(); o3.start();
        const o = out(mix, 'motor', p);
        return { o1, o2, o3, bp, lp, ...o };
      });
      // --- tyres, floor, hull
      const cr = src(crackle, 1), chp = C.createBiquadFilter(); chp.type = 'bandpass'; chp.frequency.value = 2200; chp.Q.value = 0.5; cr.connect(chp);
      T.crack = { src: cr, ...out(chp, 'terrain', 0) };
      const rn = src(nb), rlp = C.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 170; rn.connect(rlp);
      T.rumble = out(rlp, 'terrain', 0);
      const sq = src(nb), sbp = C.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 3100; sbp.Q.value = 9; sq.connect(sbp);
      T.squeal = { bp: sbp, ...out(sbp, 'terrain', 0) };
      // --- Pip: four ducted fans
      const pm = C.createGain(); pm.gain.value = 1;
      const plp = C.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 3200; plp.connect(pm);
      T.pipo = [1, 1.027, 0.968, 1.061].map(m => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 400 * m; const g = C.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(plp); o.start(); return { o, m }; });
      const hum = C.createOscillator(); hum.type = 'sine'; hum.frequency.value = 160; const hg = C.createGain(); hg.gain.value = 0.5; hum.connect(hg); hg.connect(pm); hum.start(); T.pipHum = hum;
      const air = src(nb), abp = C.createBiquadFilter(); abp.type = 'bandpass'; abp.frequency.value = 1900; abp.Q.value = 0.6; const ag = C.createGain(); ag.gain.value = 0.9; air.connect(abp); abp.connect(ag); ag.connect(pm);
      T.pip = { air: abp, ...out(pm, 'pip', 0) };
      // --- servo buzz (MG90S): a 50 Hz pulse train through a band filter, plus gear noise
      const so = C.createOscillator(); so.type = 'sawtooth'; so.frequency.value = 62;
      const sf = C.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1300; sf.Q.value = 2.2; so.connect(sf); so.start();
      const sn = src(nb), snf = C.createBiquadFilter(); snf.type = 'bandpass'; snf.frequency.value = 3000; snf.Q.value = 1; sn.connect(snf);
      const sm = C.createGain(); sm.gain.value = 1; sf.connect(sm); const sng = C.createGain(); sng.gain.value = 0.25; snf.connect(sng); sng.connect(sm);
      T.servo = { o: so, ...out(sm, 'fx', 0) };
      A.applyVol();
    } catch (e) { A.ctx = null; }
  };
  A.ok = () => !!(A.ctx && A.on);
  A.resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.applyVol = () => {
    if (!A.ctx) return;
    A.master.gain.value = A.on ? A.vol.master * 0.7 : 0;
    for (const k in bus) bus[k].gain.value = A.vol[k] != null ? A.vol[k] : 1;
  };
  A.setOn = v => { A.on = v; if (v) A.init(); A.applyVol(); };
  A.setVol = (k, v) => { A.vol[k] = v; A.applyVol(); };

  // ---------- one-shot helpers
  function tone(type, f0, f1, dur, g, b, p, at) {
    const C = A.ctx, t = C.currentTime + (at || 0), o = C.createOscillator(), e = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(e); const pn = pan(C, p); if (pn) { e.connect(pn); pn.connect(bus[b]); } else e.connect(bus[b]);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(fc, dur, g, type, b, p, q, at) {
    const C = A.ctx, t = C.currentTime + (at || 0), s = C.createBufferSource(), f = C.createBiquadFilter(), e = C.createGain();
    s.buffer = nb; f.type = type || 'lowpass'; f.frequency.value = fc; f.Q.value = q || 0.8;
    e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(e); const pn = pan(C, p); if (pn) { e.connect(pn); pn.connect(bus[b]); } else e.connect(bus[b]);
    s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }
  const once = (k, ms) => { const n = performance.now(); if (n < (last[k] || 0)) return false; last[k] = n + ms; return true; };

  // Named events. g = strength 0..1, p = stereo position -1..1
  A.ev = function (name, g = 1, p = 0) {
    if (!A.ok()) return;
    switch (name) {
      case 'thump':      tone('sine', 95, 36, 0.22, 0.3 * g, 'fx', p); noise(320, 0.12, 0.2 * g, 'lowpass', 'fx', p); break;
      case 'clunk':      if (once('clunk', 90)) { tone('triangle', 190, 70, 0.09, 0.16 * g, 'fx', p); noise(1400, 0.05, 0.1 * g, 'bandpass', 'fx', p, 2); } break;
      case 'click':      tone('square', 1800, 900, 0.05, 0.12, 'fx', p); noise(4000, 0.04, 0.08, 'highpass', 'fx', p); break;
      case 'buzz':       if (once('buzz', 900)) tone('sawtooth', 150, 95, 0.22, 0.14, 'alert', p); break;
      case 'crash':      noise(900, 0.7, 0.5, 'lowpass', 'fx', p); tone('sine', 70, 28, 0.6, 0.5, 'fx', p); noise(2500, 0.25, 0.25, 'bandpass', 'fx', p, 1, 0.09); break;
      case 'dmg':        tone('sine', 110, 40, 0.2, 0.3, 'fx', p); noise(2200, 0.15, 0.25, 'bandpass', 'fx', p, 1.2); tone('triangle', 640, 300, 0.12, 0.1, 'fx', p, 0.02); break;
      case 'wall':       tone('sine', 74, 32, 0.3, 0.4 * g, 'fx', p); noise(420, 0.2, 0.3 * g, 'lowpass', 'fx', p); break;
      case 'barrel':     for (const [f, m] of [[172, 1], [345, 0.6], [517, 0.35], [790, 0.2]]) tone('sine', f, f * 0.97, 0.55, 0.13 * m * g, 'fx', p);
                         noise(2400, 0.07, 0.18 * g, 'bandpass', 'fx', p, 1.4); break;
      case 'cone':       // hollow plastic tok when a cone is hit
                         tone('triangle', 540, 300, 0.09, 0.28 * g, 'fx', p); noise(720, 0.07, 0.3 * g, 'bandpass', 'fx', p, 5); noise(3200, 0.02, 0.1 * g, 'highpass', 'fx', p); break;
      case 'coneLand':   if (once('coneLand', 70)) { tone('triangle', 420, 230, 0.07, 0.16 * g, 'fx', p); noise(650, 0.05, 0.16 * g, 'bandpass', 'fx', p, 5); } break;
      case 'coneSlide':  if (once('coneSlide', 120)) noise(1600, 0.12, 0.05 * g, 'bandpass', 'terrain', p, 1.2); break;
      case 'packet':     tone('sine', 190, 70, 0.08, 0.22 * g, 'fx', p); noise(1100, 0.1, 0.12 * g, 'lowpass', 'fx', p); break;
      case 'flap':       tone('triangle', 260, 120, 0.1, 0.16, 'fx', p); noise(2000, 0.05, 0.1, 'bandpass', 'fx', p, 2); break;
      case 'relay':      noise(3600, 0.014, 0.35, 'bandpass', 'alert', p, 1.5); tone('square', 140, 90, 0.04, 0.2, 'alert', p); tone('sine', 70, 50, 0.08, 0.2, 'alert', p, 0.012); break;
      case 'arm':        tone('square', 1760, 1760, 0.09, 0.12, 'alert', p); tone('square', 2349, 2349, 0.12, 0.12, 'alert', p, 0.11); break;
      case 'disarm':     tone('square', 2349, 2349, 0.09, 0.12, 'alert', p); tone('square', 1760, 1760, 0.14, 0.12, 'alert', p, 0.11); break;
      case 'beep':       tone('square', 2700, 2700, 0.14 * g, 0.16, 'alert', p); break;          // piezo buzzer, the low-battery alarm
      case 'lowbat':     if (once('lowbat', 1500)) { tone('square', 2700, 2700, 0.16, 0.18, 'alert', p); tone('square', 2700, 2700, 0.16, 0.18, 'alert', p, 0.26); } break;
      case 'stop':       A.ev('relay'); tone('square', 2700, 2700, 0.35, 0.15, 'alert', p, 0.05); break;
      case 'found':      tone('sine', 880, 880, 0.1, 0.16, 'alert', p); tone('sine', 1320, 1320, 0.18, 0.16, 'alert', p, 0.1); break;
      case 'win':        [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.25, 0.16, 'alert', p, i * 0.13)); break;
      case 'lose':       [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.3, 0.16, 'alert', p, i * 0.17)); break;
      case 'ui':         tone('sine', 1200, 1200, 0.03, 0.06, 'alert', p); break;
    }
  };

  // ---------- continuous sound. s = {dt, vL, vR (wheel speed, mm/s), load 0..1, slip 0..1, rate (joint rad/s), servo 0..1,
  //                                pip:{spin, thrust, att, pan}, att (distance falloff for Bob), pan}
  A.frame = function (s) {
    if (!A.ok()) return;
    const C = A.ctx, tc = C.currentTime, set = (p, v, t) => p.setTargetAtTime(v, tc, t || 0.06);
    const att = s.att == null ? 1 : s.att, ld = s.load || 0, sl = s.slip || 0, vm = s.vmax || 520;
    const sp = [Math.abs(s.vL), Math.abs(s.vR)], mean = (sp[0] + sp[1]) / 2;
    T.side.forEach((m, i) => {
      const n = Math.min(1.15, sp[i] / vm), fc = 118 + 650 * n + ld * 30;
      set(m.o1.frequency, fc, 0.05); set(m.o2.frequency, fc * 2.01, 0.05); set(m.o3.frequency, fc * 0.5, 0.05);
      set(m.bp.frequency, 420 + fc * 1.4, 0.1);
      const stall = ld > 0.88 && n < 0.12;                                   // stalled: strained, high whine
      if (stall) set(m.o1.frequency, 900 + 40 * Math.sin(tc * 30), 0.02);
      const g = sp[i] > 6 || stall ? (0.025 + 0.07 * n + 0.075 * ld + (stall ? 0.05 : 0)) * att : 0;
      set(m.g.gain, g);
    });
    const nm = Math.min(1.15, mean / vm);
    T.crack.src.playbackRate.setTargetAtTime(0.55 + nm * 1.7, tc, 0.08);
    set(T.crack.g.gain, nm * 0.30 * (1 + sl * 0.9) * att);
    set(T.rumble.g.gain, Math.min(0.32, nm * 0.1 + Math.min(0.2, (s.rate || 0) * 0.04)) * att);
    set(T.squeal.g.gain, Math.max(0, sl - 0.3) * 0.17 * att);
    const pp = s.pip || { spin: 0 }, pa = pp.att == null ? 1 : pp.att, th = pp.thrust == null ? 0.55 : pp.thrust;
    T.pipo.forEach(o => set(o.o.frequency, 380 * o.m * (0.5 + 0.9 * th) * (0.35 + 0.65 * pp.spin), 0.12));
    set(T.pipHum.frequency, 120 * (0.4 + th) * (0.35 + 0.65 * pp.spin), 0.12);
    set(T.pip.air.frequency, 1500 + 1300 * th, 0.15);
    set(T.pip.g.gain, pp.spin * 0.13 * pa);
    if (T.pip.pn) set(T.pip.pn.pan, Math.max(-1, Math.min(1, pp.pan || 0)), 0.1);
    set(T.servo.g.gain, (s.servo || 0) * 0.1, 0.03);
    set(T.servo.o.frequency, 52 + (s.servo || 0) * 30, 0.05);
  };
  return A;
}
