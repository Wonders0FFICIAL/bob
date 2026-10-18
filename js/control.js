import { $, el } from "./dom.js";
import { S, hooks } from "./state.js";
import { store, KEYS } from "./storage.js";
import { goDark, setStatus, setPlaceholder, showSwitch, paintFlip, goLive, endSwitch } from "./ui.js";
import { nextLevel } from "./live/quality.js";

const { feed, rtc, msg, ph, urlInput, flip, quality, zoomIn, zoomOut } = el;

export function endActive() {
  if (S.active === "demo" && S.stopDemo) { S.stopDemo(); S.stopDemo = null; }
  S.lanOn = false;
  feed.removeAttribute("src");
  hooks.stopViewer();
  S.active = null;
  goDark();
}

export function claim(kind) {
  endActive();
  S.active = kind;
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

export function setMode(m) {
  S.mode = m;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("pane-internet").hidden = m !== "internet";
  $("pane-local").hidden = m !== "local";
  if (!S.active) setPlaceholder();
}

function setZoom(z) {
  if (S.active !== "lan" && S.active !== "rtc") { msg.textContent = "Connect to Bob's camera first."; return; }
  S.zoom = Math.max(0, Math.min(100, z));
  msg.textContent = "Zoom " + S.zoom + "%";
  if (S.active === "rtc") {
    if (S.digitalZoom) rtc.style.transform = S.zoom ? "scale(" + (1 + S.zoom / 50) + ")" : "";
    else if (!hooks.sendCommand({ t: "zoom", v: S.zoom })) msg.textContent = "Bob's camera isn't online.";
  } else {
    phone("/ptz?zoom=" + S.zoom);
  }
}

export function initControl() {
  const saved = store.read(KEYS.lan);
  if (saved) urlInput.value = saved;

  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.mode === S.mode) return;
      if (S.active === "lan" || S.active === "rtc") endActive();
      setMode(b.dataset.mode);
      store.write(KEYS.mode, b.dataset.mode);
    });
  });
  setMode(store.read(KEYS.mode) === "local" ? "local" : "internet");

  $("connectlan").addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return setStatus("err", "Error", "Enter the stream address first.");
    if (location.protocol === "https:" && url.startsWith("http:")) {
      return setStatus("err", "Blocked", "This page is on https, so the browser blocks an http camera. Use Internet mode, or open this page over http (for example from localhost) to use Local network mode.");
    }
    claim("lan");
    S.lanOn = true;
    S.zoom = 0;
    store.write(KEYS.lan, url);
    setStatus("off", "Connecting…", "Connecting. Your device must be on the same WiFi as the phone.");
    feed.src = streamUrl();
    feed.hidden = false;
    ph.hidden = true;
  });
  urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") $("connectlan").click(); });

  feed.addEventListener("load", () => { if (S.lanOn) goLive(); });
  feed.addEventListener("error", () => {
    if (!S.lanOn) return;
    S.lanOn = false;
    S.active = null;
    goDark("err", "No signal", "Can't reach the camera. Check the address and that you're on the same WiFi.");
  });

  flip.addEventListener("click", () => {
    if (S.active !== "lan" && S.active !== "rtc") { msg.textContent = "Connect to Bob's camera first."; return; }
    const front = flip.getAttribute("aria-pressed") !== "true";
    if (S.active === "rtc") {
      if (!hooks.sendCommand({ t: "flip", front })) { msg.textContent = "Bob's camera isn't online."; return; }
      showSwitch(front, rtc);
      return;
    }
    paintFlip(front);
    phone("/settings/ffc?set=" + (front ? "on" : "off"));
    showSwitch(front, feed);
    setTimeout(() => { if (S.lanOn) feed.src = streamUrl(); }, 900);
  });

  quality.addEventListener("click", () => {
    if (S.active === "lan") { msg.textContent = "In Local network mode, set the quality in the IP Webcam app."; return; }
    if (S.active !== "rtc") { msg.textContent = "Connect to Bob's camera first."; return; }
    const level = nextLevel(quality.dataset.level);
    if (!hooks.sendCommand({ t: "quality", level })) { msg.textContent = "Bob's camera isn't online."; return; }
    msg.textContent = "Asking Bob's phone for " + level + " quality…";
  });

  zoomIn.addEventListener("click", () => setZoom(S.zoom + 20));
  zoomOut.addEventListener("click", () => setZoom(S.zoom - 20));

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
    const s = document.querySelector($("demo").hidden ? ".screen" : ".screen-wrap");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (s.requestFullscreen) s.requestFullscreen();
    else if (s.webkitRequestFullscreen) s.webkitRequestFullscreen();
  });
}
