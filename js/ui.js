import { $, el, pad } from "./dom.js";
import { S } from "./state.js";
import { LABELS, isLevel } from "./live/quality.js";

const { feed, rtc, badge, msg, ph, phTitle, phText, hud, clock, elapsed, flip, quality, zoomIn, zoomOut } = el;

export function channelNote(text) {
  return S.channel ? text.replace(/\.$/, "") + " (" + S.channel + ")." : text;
}

export function setStatus(state, text, note) {
  badge.className = "badge " + state;
  badge.textContent = text;
  msg.textContent = note || "";
}

export function idleText() {
  return S.mode === "local"
    ? "Enter the camera address below and press Connect, or try the demo."
    : "Enter the passcode below and press Connect, or try the demo.";
}

export function setPlaceholder(title, text) {
  phTitle.textContent = title || "Bob's eyes are closed";
  phText.textContent = text || idleText();
}

export function tickHud() {
  const now = new Date();
  clock.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  if (S.liveSince !== null) {
    const s = Math.floor((Date.now() - S.liveSince) / 1000);
    elapsed.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
  }
}

export function endSwitch() {
  clearTimeout(S.switchTimer);
  feed.classList.remove("switching");
  rtc.classList.remove("switching");
  $("switchlabel").hidden = true;
}

export function showSwitch(front, target) {
  $("switchlabel").textContent = "Switching to " + (front ? "front" : "back") + " camera…";
  $("switchlabel").hidden = false;
  target.classList.add("switching");
  clearTimeout(S.switchTimer);
  S.switchTimer = setTimeout(endSwitch, 6000);
}

export function paintQuality(level) {
  quality.textContent = "Quality: " + (isLevel(level) ? LABELS[level].toLowerCase() : "standard");
  quality.dataset.level = isLevel(level) ? level : "standard";
}

export function zoomEnabled(on) {
  zoomIn.disabled = !on;
  zoomOut.disabled = !on;
}

export function paintFlip(front) {
  flip.setAttribute("aria-pressed", String(front));
  flip.textContent = "Camera: " + (front ? "front" : "back");
}

export function goLive() {
  ph.hidden = true;
  if (S.liveSince === null) S.liveSince = Date.now();
  hud.hidden = false;
  tickHud();
  setStatus("live", "Live", S.active === "rtc" ? channelNote("Connected.") : "Connected.");
  endSwitch();
}

export function goDark(state, text, note) {
  feed.hidden = true;
  rtc.hidden = true;
  ph.hidden = false;
  setPlaceholder();
  S.liveSince = null;
  hud.hidden = true;
  elapsed.textContent = "00:00:00";
  zoomEnabled(true);
  S.digitalZoom = false;
  S.zoom = 0;
  rtc.style.transform = "";
  endSwitch();
  setStatus(state || "off", text || "Offline", note || "");
}

export function setCaps(c) {
  paintFlip(!!c.front);
  if (c.quality) paintQuality(c.quality);
  S.digitalZoom = !c.zoom;
  zoomEnabled(true);
  if (c.flipped) { S.zoom = 0; rtc.style.transform = ""; endSwitch(); }
  if (S.digitalZoom) msg.textContent = "This phone has no optical zoom, so zoom is digital.";
}

export function waiting() {
  rtc.hidden = true;
  ph.hidden = false;
  S.liveSince = null;
  hud.hidden = true;
  elapsed.textContent = "00:00:00";
  endSwitch();
  setPlaceholder("Waiting for Bob's camera", "Open this site on the phone on Bob and tap \"Use this device as Bob's camera\".");
  setStatus("off", "Waiting", channelNote("Connected to the server. Bob's camera isn't online yet."));
}

export function startClock() {
  setInterval(tickHud, 1000);
}
