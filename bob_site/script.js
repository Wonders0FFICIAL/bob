const $ = (id) => document.getElementById(id);
const BOB_VIDEO = "https://youtube.com/shorts/W0G0fOATsiU?si=inoGqdqjGMiIEF7s";

const feed = $("feed"), rtc = $("rtc"), badge = $("badge"), msg = $("msg"), ph = $("placeholder"), urlInput = $("url");
const phTitle = $("phtitle"), phText = $("phtext");
const hud = $("hud"), clockEl = $("clock"), elapsedEl = $("elapsed");
const flipBtn = $("flip"), zoomInBtn = $("zoomin"), zoomOutBtn = $("zoomout");

let active = null, mode = "internet", liveSince = null, lanOn = false, stopDemo = null, digitalZoom = false;
let switchTimer, zoom = 0;

const pad = (n) => String(n).padStart(2, "0");
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

const savedCam = read("bob-cam");
if (savedCam) urlInput.value = savedCam;

function setStatus(state, text, note) {
  badge.className = "badge " + state;
  badge.textContent = text;
  msg.textContent = note || "";
}

function idleText() {
  return mode === "local"
    ? "Enter the camera address below and press Connect, or try the demo."
    : "Enter the passcode below and press Connect, or try the demo.";
}

function setPlaceholder(title, text) {
  phTitle.textContent = title || "Bob's eyes are closed";
  phText.textContent = text || idleText();
}

function tickHud() {
  const now = new Date();
  clockEl.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  if (liveSince !== null) {
    const s = Math.floor((Date.now() - liveSince) / 1000);
    elapsedEl.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
  }
}
setInterval(tickHud, 1000);

function endSwitch() {
  clearTimeout(switchTimer);
  feed.classList.remove("switching");
  rtc.classList.remove("switching");
  $("switchlabel").hidden = true;
}

function showSwitch(front, el) {
  $("switchlabel").textContent = "Switching to " + (front ? "front" : "back") + " camera…";
  $("switchlabel").hidden = false;
  el.classList.add("switching");
  clearTimeout(switchTimer);
  switchTimer = setTimeout(endSwitch, 6000);
}

function goLive() {
  ph.hidden = true;
  if (liveSince === null) liveSince = Date.now();
  hud.hidden = false;
  tickHud();
  setStatus("live", "Live", window.Live && window.Live.channel && active === "rtc" ? "Connected (" + window.Live.channel + ")." : "Connected.");
  endSwitch();
}

function goDark(state, text, note) {
  feed.hidden = true;
  rtc.hidden = true;
  ph.hidden = false;
  setPlaceholder();
  liveSince = null;
  hud.hidden = true;
  elapsedEl.textContent = "00:00:00";
  zoomEnabled(true);
  digitalZoom = false;
  zoom = 0;
  rtc.style.transform = "";
  endSwitch();
  setStatus(state || "off", text || "Offline", note || "");
}

function endActive() {
  if (active === "demo" && stopDemo) { stopDemo(); stopDemo = null; }
  lanOn = false;
  feed.removeAttribute("src");
  if (typeof Live !== "undefined") Live.stopViewer();
  active = null;
  goDark();
}

function claim(kind) {
  endActive();
  active = kind;
}

function sendCmd(m) {
  return typeof Live !== "undefined" && Live.send(m);
}

function phoneBase() {
  try { return new URL(urlInput.value.trim()).origin; } catch { return null; }
}

function phone(path) {
  const base = phoneBase();
  if (!base) { msg.textContent = "Enter the camera address first."; return; }
  fetch(base + path, { mode: "no-cors" }).catch(() => {
    msg.textContent = "Command not sent. Check the phone is on the same WiFi.";
  });
}

function streamUrl() {
  const url = urlInput.value.trim();
  return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
}

function setMode(m) {
  mode = m;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("pane-internet").hidden = m !== "internet";
  $("pane-local").hidden = m !== "local";
  if (!active) setPlaceholder();
}

document.querySelectorAll("[data-mode]").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.mode === mode) return;
    if (active === "lan" || active === "rtc") endActive();
    setMode(b.dataset.mode);
    write("bob-mode", b.dataset.mode);
  });
});
setMode(read("bob-mode") === "local" ? "local" : "internet");

$("connectlan").addEventListener("click", () => {
  const url = urlInput.value.trim();
  if (!url) return setStatus("err", "Error", "Enter the stream address first.");
  if (location.protocol === "https:" && url.startsWith("http:")) {
    return setStatus("err", "Blocked", "This page is on https, so the browser blocks an http camera. Use Internet mode, or open this page over http (for example from localhost) to use Local network mode.");
  }
  claim("lan");
  lanOn = true;
  zoom = 0;
  write("bob-cam", url);
  setStatus("off", "Connecting…", "Connecting. Your device must be on the same WiFi as the phone.");
  feed.src = streamUrl();
  feed.hidden = false;
  ph.hidden = true;
});
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") $("connectlan").click(); });

feed.addEventListener("load", () => {
  if (lanOn) goLive();
});
feed.addEventListener("error", () => {
  if (!lanOn) return;
  lanOn = false;
  active = null;
  goDark("err", "No signal", "Can't reach the camera. Check the address and that you're on the same WiFi.");
});

function paintFlip(front) {
  flipBtn.setAttribute("aria-pressed", String(front));
  flipBtn.textContent = "Camera: " + (front ? "front" : "back");
}

function zoomEnabled(on) {
  zoomInBtn.disabled = !on;
  zoomOutBtn.disabled = !on;
}

function setCaps(c) {
  paintFlip(!!c.front);
  digitalZoom = !c.zoom;
  zoomEnabled(true);
  if (c.flipped) { zoom = 0; rtc.style.transform = ""; endSwitch(); }
  if (digitalZoom) msg.textContent = "This phone has no optical zoom, so zoom is digital.";
}

flipBtn.addEventListener("click", () => {
  if (active !== "lan" && active !== "rtc") { msg.textContent = "Connect to Bob's camera first."; return; }
  const front = flipBtn.getAttribute("aria-pressed") !== "true";
  if (active === "rtc") {
    if (!sendCmd({ t: "flip", front })) { msg.textContent = "Bob's camera isn't online."; return; }
    showSwitch(front, rtc);
    return;
  }
  paintFlip(front);
  phone("/settings/ffc?set=" + (front ? "on" : "off"));
  showSwitch(front, feed);
  setTimeout(() => { if (lanOn) feed.src = streamUrl(); }, 900);
});

function setZoom(z) {
  if (active !== "lan" && active !== "rtc") { msg.textContent = "Connect to Bob's camera first."; return; }
  zoom = Math.max(0, Math.min(100, z));
  msg.textContent = "Zoom " + zoom + "%";
  if (active === "rtc") {
    if (digitalZoom) rtc.style.transform = zoom ? "scale(" + (1 + zoom / 50) + ")" : "";
    else if (!sendCmd({ t: "zoom", v: zoom })) msg.textContent = "Bob's camera isn't online.";
  } else {
    phone("/ptz?zoom=" + zoom);
  }
}
zoomInBtn.addEventListener("click", () => setZoom(zoom + 20));
zoomOutBtn.addEventListener("click", () => setZoom(zoom - 20));

$("snap").addEventListener("click", () => {
  let src = null, w = 0, h = 0;
  if (!rtc.hidden && rtc.videoWidth) { src = rtc; w = rtc.videoWidth; h = rtc.videoHeight; }
  else if (!feed.hidden && feed.naturalWidth) { src = feed; w = feed.naturalWidth; h = feed.naturalHeight; }
  if (!src) { msg.textContent = "Connect the camera first."; return; }
  try {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0);
    c.toBlob((blob) => {
      if (!blob) { msg.textContent = "Couldn't save the snapshot."; return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rescue-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      msg.textContent = "Snapshot saved.";
    }, "image/jpeg", 0.92);
  } catch {
    const base = phoneBase();
    if (src === feed && base) window.open(base + "/photo.jpg", "_blank");
    else msg.textContent = "Couldn't save the snapshot.";
  }
});

$("full").addEventListener("click", () => {
  const s = document.querySelector(".screen");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (s.requestFullscreen) s.requestFullscreen();
  else if (s.webkitRequestFullscreen) s.webkitRequestFullscreen();
});

(function () {
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
})();

(function () {
  const btn = $("theme"), label = $("themelabel"), root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const THEMES = ["light", "dark"];
  const NAMES = { light: "Day", dark: "Night" };
  const COLORS = { light: "#EDF1F3", dark: "#0A141B" };
  function sync() {
    const next = THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % THEMES.length];
    label.textContent = NAMES[next];
    btn.setAttribute("aria-label", "Switch to " + NAMES[next].toLowerCase() + " theme");
  }
  btn.addEventListener("click", () => {
    const next = THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % THEMES.length];
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    if (meta) meta.content = COLORS[next];
    try { localStorage.setItem("bob-theme", next); } catch {}
    sync();
    setTimeout(() => root.classList.remove("theme-anim"), 450);
  });
  sync();
})();

(function () {
  const btn = $("copycam");
  if (!btn) return;
  const url = "https://bob.jrofficial.org/#camera";
  btn.addEventListener("click", async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {}
    btn.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
  });
})();

(function () {
  const section = $("watch"), nav = $("watchnav"), frame = $("yt"), out = $("ytlink");
  const raw = BOB_VIDEO.trim();
  const m = raw.match(/(?:shorts\/|youtu\.be\/|v=|embed\/)([\w-]{11})/) || raw.match(/^([\w-]{11})$/);
  if (!m) return;
  frame.src = "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0&playsinline=1";
  out.href = "https://www.youtube.com/shorts/" + m[1];
  section.hidden = false;
  nav.hidden = false;
})();

(function () {
  const cv = $("demo"), btn = $("demobtn"), panel = $("demopanel"), logEl = $("demolog");
  const ctx = cv.getContext("2d");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = cv.width, H = cv.height, RANGE = 190;
  const BASE = { x: 70, y: 410 };
  const RUBBLE = [[200, 300, 26], [300, 160, 32], [460, 330, 22], [150, 150, 20], [540, 200, 28], [380, 420, 18]];

  let on = false, raf = 0, frame = 0;
  let bob, target, onArrive, ents, keys, trail, battery, path = [];

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const stamp = () => { const d = new Date(); return pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };

  function log(text, kind) {
    const li = document.createElement("li");
    if (kind) li.className = kind;
    li.innerHTML = "<b>" + stamp() + "</b>";
    li.append(text);
    logEl.prepend(li);
    while (logEl.children.length > 6) logEl.lastChild.remove();
  }

  const CELL = 20, COLS = W / CELL, ROWS = H / CELL, PAD = 22;
  const blocked = (x, y, pad = PAD) => RUBBLE.some(([rx, ry, r]) => Math.hypot(x - rx, y - ry) < r + pad);

  function clear(a, b) {
    const n = Math.ceil(dist(a, b) / 6);
    for (let i = 1; i <= n; i++) {
      if (blocked(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    }
    return true;
  }

  function findPath(from, to) {
    const cell = (p) => ({ c: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL))), r: Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL))) });
    const id = (c, r) => r * COLS + c;
    const centre = (i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
    const s0 = cell(from), g0 = cell(to), start = id(s0.c, s0.r), goal = id(g0.c, g0.r);
    const g = { [start]: 0 }, parent = {}, open = [start], done = new Set();
    const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked(c * CELL + CELL / 2, r * CELL + CELL / 2);

    while (open.length) {
      let k = 0;
      for (let i = 1; i < open.length; i++) {
        const f = (n) => g[n] + dist(centre(n), centre(goal));
        if (f(open[i]) < f(open[k])) k = i;
      }
      const cur = open.splice(k, 1)[0];
      if (cur === goal) break;
      done.add(cur);
      const cc = cur % COLS, cr = Math.floor(cur / COLS);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        const nc = cc + dc, nr = cr + dr, n = id(nc, nr);
        if (done.has(n) || !free(nc, nr)) continue;
        if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue;
        const ng = g[cur] + (dc && dr ? 1.414 : 1);
        if (g[n] === undefined || ng < g[n]) { g[n] = ng; parent[n] = cur; if (!open.includes(n)) open.push(n); }
      }
    }
    if (g[goal] === undefined) return null;

    const pts = [];
    for (let n = goal; n !== start; n = parent[n]) pts.unshift(centre(n));
    pts[pts.length - 1] = { x: to.x, y: to.y };
    const out = [];
    let cur = from, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clear(cur, pts[j])) j--;
      out.push(pts[j]); cur = pts[j]; i = j + 1;
    }
    return out;
  }

  function place() {
    for (let i = 0; i < 80; i++) {
      const p = { x: 90 + Math.random() * (W - 180), y: 70 + Math.random() * (H - 190) };
      if (dist(p, bob) > 250 && !blocked(p.x, p.y, 45)) return p;
    }
    return { x: 540, y: 120 };
  }

  function placeNear(o) {
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * 6.283, d = 60 + Math.random() * 30;
      const p = { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d };
      if (p.x > 40 && p.x < W - 40 && p.y > 40 && p.y < H - 70 && !blocked(p.x, p.y, 35)) return p;
    }
    return { x: o.x + 60, y: o.y };
  }

  function goto(p, stop, cb) {
    const route = findPath(bob, p);
    if (!route) { log("No safe route found.", "alert"); return false; }
    target = { x: p.x, y: p.y, stop }; onArrive = cb; path = route;
    return true;
  }

  function reset() {
    bob = { x: BASE.x, y: BASE.y, a: -0.8 };
    target = onArrive = null; path = [];
    ents = []; keys = {}; trail = []; battery = 100;
    logEl.innerHTML = "";
    log("Bob online at base. Awaiting orders.");
  }

  const COMMANDS = {
    fire() {
      const p = place();
      ents = ents.filter((x) => x.type !== "fire" && x.type !== "person");
      ents.push({ type: "fire", x: p.x, y: p.y, found: false });
      log("ALERT: fire reported in the " + (p.x > W / 2 ? "east" : "west") + " wing.", "alert");
      log("Dispatching Bob. Route planned around the rubble.");
      goto(p, 45, () => {
        log("Fire confirmed at " + Math.round(temp()) + "°C. Photo added to report.", "alert");
        setTimeout(() => on && !target && log("Report sent to the rescue team. Bob holding position.", "ok"), 1500);
      });
    },
    survivor() {
      const fire = ents.find((x) => x.type === "fire");
      const p = fire ? placeNear(fire) : place();
      ents = ents.filter((x) => x.type !== "person");
      ents.push({ type: "person", x: p.x, y: p.y, found: false });
      log(fire ? "Search started around the fire area." : "Search started. Scanning for heat signatures.");
      goto(p, 40, () => log("Person found and responsive. Location sent to the crew.", "ok"));
    },
    base() {
      log("Returning to base.");
      goto(BASE, 14, () => log("Bob docked. Battery " + Math.round(battery) + "%.", "ok"));
    },
    stop() {
      target = onArrive = null; path = [];
      log("Stopped. Holding position.");
    },
  };

  function temp() {
    let t = 24;
    for (const e of ents) {
      if (e.type !== "fire") continue;
      const d = dist(bob, e);
      if (d < 220) t = Math.max(t, 24 + 380 * (1 - d / 220));
    }
    return t;
  }

  function step() {
    const turn = 0.05, speed = 2.2;
    let manual = false;
    if (keys.ArrowLeft)  { bob.a -= turn; manual = true; }
    if (keys.ArrowRight) { bob.a += turn; manual = true; }
    if (keys.ArrowUp)    { bob.x += Math.cos(bob.a) * speed; bob.y += Math.sin(bob.a) * speed; manual = true; }
    if (keys.ArrowDown)  { bob.x -= Math.cos(bob.a) * 1.5;   bob.y -= Math.sin(bob.a) * 1.5;   manual = true; }
    if (manual && target) { target = onArrive = null; path = []; log("Manual control."); }

    if (target) {
      const wp = path[0] || target;
      if (path.length && dist(bob, wp) < 10) path.shift();
      const want = Math.atan2(wp.y - bob.y, wp.x - bob.x);
      let diff = ((want - bob.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      bob.a += Math.max(-0.06, Math.min(0.06, diff));
      if (Math.abs(diff) < 0.5) { bob.x += Math.cos(bob.a) * speed; bob.y += Math.sin(bob.a) * speed; }
      if (dist(bob, target) <= target.stop) {
        const cb = onArrive; target = onArrive = null; path = [];
        if (cb) cb();
      }
    }

    for (const [rx, ry, r] of RUBBLE) {
      const d = dist(bob, { x: rx, y: ry }), min = r + 10;
      if (d < min) { bob.x = rx + (bob.x - rx) / d * min; bob.y = ry + (bob.y - ry) / d * min; }
    }
    bob.x = Math.max(20, Math.min(W - 20, bob.x));
    bob.y = Math.max(20, Math.min(H - 40, bob.y));
    if (frame % 6 === 0) {
      const last = trail[trail.length - 1];
      if (!last || dist(last, bob) > 6) { trail.push({ x: bob.x, y: bob.y }); if (trail.length > 140) trail.shift(); }
    }
    if (target || manual) battery = Math.max(1, battery - 0.01);

    for (const e of ents) {
      if (!e.found && dist(bob, e) < RANGE * 0.8) {
        e.found = true;
        log(e.type === "fire" ? "Thermal hotspot detected ahead." : ents.some((x) => x.type === "fire") ? "Heat signature detected: person near the fire." : "Heat signature detected: person.", e.type === "fire" ? "alert" : "ok");
      }
    }
  }

  function draw() {
    const t = calm ? 0 : frame;
    ctx.fillStyle = "#050B10"; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    for (const [x, y, r] of RUBBLE) {
      ctx.fillStyle = "#14222C"; ctx.strokeStyle = "#2A3F4D"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * 6.283, rr = r * (0.75 + 0.25 * Math.sin(i * 2.7 + x));
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.strokeStyle = "#8EA3B2"; ctx.lineWidth = 2; ctx.strokeRect(BASE.x - 16, BASE.y - 16, 32, 32);
    ctx.fillStyle = "#8EA3B2"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("BASE", BASE.x, BASE.y + 31);

    if (trail.length > 1) {
      ctx.strokeStyle = "rgba(255,210,31,.3)"; ctx.setLineDash([4, 6]); ctx.beginPath();
      trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke(); ctx.setLineDash([]);
    }

    if (target && path.length) {
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(bob.x, bob.y);
      path.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
    }

    for (const e of ents) {
      if (e.type === "fire") {
        if (!e.found) {
          ctx.strokeStyle = "rgba(229,50,45,.7)"; ctx.setLineDash([5, 5]); ctx.beginPath();
          ctx.arc(e.x, e.y, 24, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = "#FF9C94"; ctx.fillText("REPORTED", e.x, e.y + 40);
        } else {
          const r = 22 + Math.sin(t / 5 + e.x) * 4;
          const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, r);
          g.addColorStop(0, "#FFE066"); g.addColorStop(.5, "#FF7A1F"); g.addColorStop(1, "rgba(229,50,45,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.fill();
          ctx.fillStyle = "#FF9C94"; ctx.fillText("FIRE", e.x, e.y + 40);
        }
      } else if (e.found) {
        const pr = 10 + (calm ? 0 : (t % 60) / 4);
        ctx.strokeStyle = "rgba(30,158,90," + (calm ? .6 : 1 - (t % 60) / 60) + ")";
        ctx.beginPath(); ctx.arc(e.x, e.y, pr, 0, 7); ctx.stroke();
        ctx.fillStyle = "#1E9E5A"; ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, 7); ctx.fill();
        ctx.fillStyle = "#6EE7A8"; ctx.fillText("PERSON", e.x, e.y + 40);
      }
    }

    ctx.strokeStyle = "rgba(255,210,31,.16)";
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(bob.x, bob.y, RANGE * i / 3, 0, 7); ctx.stroke(); }
    if (ctx.createConicGradient) {
      const sw = calm ? bob.a : t * 0.045;
      const g = ctx.createConicGradient(sw - 0.9, bob.x, bob.y);
      g.addColorStop(0, "rgba(255,210,31,0)");
      g.addColorStop(0.14, "rgba(255,210,31,.35)");
      g.addColorStop(0.1401, "rgba(255,210,31,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bob.x, bob.y, RANGE, 0, 7); ctx.fill();
    }

    ctx.save(); ctx.translate(bob.x, bob.y); ctx.rotate(bob.a);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(70, -28); ctx.lineTo(70, 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#FFD21F"; ctx.strokeStyle = "#0D1C26"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    const hdg = Math.round(((bob.a * 180 / Math.PI + 90) % 360 + 360) % 360);
    ctx.fillStyle = "rgba(5,11,16,.85)"; ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = "#E6EDF2"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("TEMP " + Math.round(temp()) + "°C    HDG " + pad(hdg).padStart(3, "0") + "°    BATT " + Math.round(battery) + "%    " + (target ? "AUTO" : "MANUAL"), 14, H - 9);
    ctx.textAlign = "center";
  }

  function loop() {
    frame++; step(); draw();
    if (on) raf = requestAnimationFrame(loop);
  }

  function stop() {
    on = false; cancelAnimationFrame(raf);
    cv.hidden = true; panel.hidden = true;
    btn.setAttribute("aria-pressed", false); btn.textContent = "Demo view";
  }

  function start() {
    claim("demo");
    stopDemo = stop;
    on = true; reset();
    btn.setAttribute("aria-pressed", true); btn.textContent = "Demo view: on";
    feed.hidden = true; rtc.hidden = true; ph.hidden = true; cv.hidden = false; panel.hidden = false;
    setStatus("demo", "Demo", "Simulated mission. Bob isn't connected. Drive with the arrow keys.");
    loop(); cv.focus({ preventScroll: true });
  }

  btn.addEventListener("click", () => {
    if (on) endActive();
    else start();
  });

  panel.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cmd]");
    if (c) { COMMANDS[c.dataset.cmd](); cv.focus({ preventScroll: true }); }
  });

  cv.addEventListener("keydown", (e) => { if (e.key.startsWith("Arrow")) { keys[e.key] = true; e.preventDefault(); } });
  cv.addEventListener("keyup", (e) => { delete keys[e.key]; });
  cv.addEventListener("blur", () => { keys = {}; });
  panel.querySelectorAll("[data-key]").forEach((b) => {
    const k = b.dataset.key;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); keys[k] = true; });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { delete keys[k]; }));
  });
})();