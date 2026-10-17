import { $ } from "../dom.js";
import { S } from "../state.js";
import { store, KEYS, MAX_AGE } from "../storage.js";
import { channelNote } from "../ui.js";
import { LABELS, levelOf } from "./quality.js";
import { getToken } from "./token.js";
import { CameraSession } from "./camera-session.js";

export function initCamera() {
  const LK = window.LivekitClient;
  const panel = $("campanel"), preview = $("campreview"), codeInput = $("camcode");
  const msg = $("cammsg"), batt = $("cambatt"), startBtn = $("camstart"), stopBtn = $("camstop");
  const remember = $("remembercam");
  const qualitySelect = $("camquality");
  const savedQuality = levelOf(store.read(KEYS.quality));
  qualitySelect.value = savedQuality;
  let wake = null, battReady = false;

  const say = (text, bad) => {
    msg.textContent = text || "";
    msg.classList.toggle("bad", !!bad);
  };

  const buttons = (running) => {
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    codeInput.disabled = running;
  };

  async function lockScreen() {
    try {
      if (navigator.wakeLock && session.want && document.visibilityState === "visible") {
        wake = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }

  function releaseScreen() {
    try { if (wake) wake.release(); } catch {}
    wake = null;
  }

  function watchBattery() {
    if (battReady || !navigator.getBattery) return;
    battReady = true;
    navigator.getBattery().then((b) => {
      const upd = () => { batt.textContent = "Battery " + Math.round(b.level * 100) + "%" + (b.charging ? " (charging)" : ""); };
      upd();
      b.addEventListener("levelchange", upd);
      b.addEventListener("chargingchange", upd);
    }).catch(() => {});
  }

  const session = new CameraSession({
    LK: LK || {},
    getToken,
    quality: savedQuality,
    emit(ev, p) {
      switch (ev) {
        case "channel": S.channel = p; break;
        case "say": say(p.text, p.bad); break;
        case "teardown": preview.srcObject = null; break;
        case "denied": store.forgetSecret(KEYS.camera); break;
        case "quality":
          qualitySelect.value = p.level;
          store.write(KEYS.quality, p.level);
          if (session.track) say("Video quality set to " + LABELS[p.level].toLowerCase() + ".");
          break;
        case "republished":
          if (p.track) p.track.attach(preview);
          break;
        case "stopped":
          releaseScreen();
          buttons(false);
          say(p.note);
          break;
        case "streaming-note": say(channelNote("Streaming to the control room.")); break;
        case "streaming":
          if (p.track) p.track.attach(preview);
          if (remember.checked) store.saveSecret(KEYS.camera, session.secret);
          else store.forgetSecret(KEYS.camera);
          lockScreen();
          watchBattery();
          say(channelNote("Streaming to the control room."));
          break;
      }
    },
  });

  function start() {
    const code = codeInput.value.trim();
    if (!code) return say("Enter the camera passcode.", true);
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return say("This browser can't use the camera on this page. Open the https site in Chrome.", true);
    }
    if (location.protocol === "file:") return say("Open the deployed website on the phone, not a file.", true);
    if (!(LK && LK.Room)) return say("The video library didn't load. Reload the page and try again.", true);
    buttons(true);
    session.start(code);
  }

  function open() {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("camopen").addEventListener("click", open);
  $("camclose").addEventListener("click", () => {
    session.stop("");
    panel.hidden = true;
  });
  qualitySelect.addEventListener("change", () => session.setQuality(qualitySelect.value));
  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", () => session.stop());
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !startBtn.disabled) start(); });
  remember.addEventListener("change", () => { if (!remember.checked) store.forgetSecret(KEYS.camera); });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && session.want) lockScreen();
  });
  window.addEventListener("pagehide", () => {
    session.want = false;
    session.teardown();
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#camera") open(); });

  const saved = store.loadSecret(KEYS.camera, MAX_AGE.camera);
  if (saved) { codeInput.value = saved; remember.checked = true; }
  if (location.hash === "#camera") {
    open();
    if (saved) start();
  }

  return session;
}
