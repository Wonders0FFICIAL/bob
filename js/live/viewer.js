import { $, el } from "../dom.js";
import { S, hooks } from "../state.js";
import { store, KEYS, MAX_AGE } from "../storage.js";
import { setStatus, setPlaceholder, goLive, goDark, setCaps, endSwitch, waiting, channelNote } from "../ui.js";
import { claim } from "../control.js";
import { getToken } from "./token.js";
import { ViewerSession } from "./viewer-session.js";

export function initViewer() {
  const LK = window.LivekitClient;
  const { rtc, ph, msg, hud } = el;
  const codeInput = $("code");
  const remember = $("rememberview");

  const libReady = () => !!(LK && LK.Room);

  const session = new ViewerSession({
    LK: LK || {},
    getToken,
    hasVideo: () => !rtc.hidden && !!rtc.videoWidth,
    emit(ev, p) {
      switch (ev) {
        case "channel": S.channel = p; break;
        case "connecting":
          ph.hidden = false;
          setPlaceholder("Connecting…", "Joining Bob's channel.");
          setStatus("off", "Connecting…", "Contacting the server…");
          break;
        case "video":
          p.track.attach(rtc);
          rtc.hidden = false;
          ph.hidden = true;
          break;
        case "video-gone": p.track.detach(rtc); break;
        case "receiving": setStatus("off", "Connecting…", "Receiving video…"); break;
        case "camera-online": setStatus("off", "Connecting…", "Bob's camera is online."); break;
        case "waiting": waiting(); break;
        case "caps": setCaps(p); break;
        case "command-error": msg.textContent = p; endSwitch(); break;
        case "reconnecting": setStatus("err", "Reconnecting…", "Connection dropped. Retrying…"); break;
        case "live": setStatus("live", "Live", channelNote("Connected.")); break;
        case "dropped": rtc.srcObject = null; break;
        case "retry":
          rtc.hidden = true;
          ph.hidden = false;
          S.liveSince = null;
          hud.hidden = true;
          setPlaceholder("Reconnecting…", "Lost the connection. Trying again.");
          setStatus("err", "Reconnecting…", p.note);
          break;
        case "fatal":
          if (p.denied) store.forgetSecret(KEYS.viewer);
          S.active = null;
          goDark("err", p.badge || "Error", p.text);
          break;
        case "joined":
          if (remember.checked) store.saveSecret(KEYS.viewer, session.code);
          else store.forgetSecret(KEYS.viewer);
          break;
      }
    },
  });

  function connect() {
    const code = codeInput.value.trim();
    if (!code) return setStatus("err", "Error", "Enter the passcode first.");
    if (location.protocol === "file:") {
      return setStatus("err", "Error", "Internet mode needs the deployed website. From a file, use Local network mode.");
    }
    if (!libReady()) return setStatus("err", "Error", "The video library didn't load. Reload the page and try again.");
    claim("rtc");
    S.zoom = 0;
    session.start(code);
  }

  hooks.stopViewer = () => {
    session.stop();
    rtc.srcObject = null;
    rtc.style.transform = "";
  };
  hooks.sendCommand = (m) => session.send(m);

  $("connect").addEventListener("click", connect);
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });
  remember.addEventListener("change", () => { if (!remember.checked) store.forgetSecret(KEYS.viewer); });
  rtc.addEventListener("playing", () => { if (S.active === "rtc") goLive(); });
  window.addEventListener("pagehide", () => session.stop());

  const saved = store.loadSecret(KEYS.viewer, MAX_AGE.viewer);
  if (saved) { codeInput.value = saved; remember.checked = true; }
  if (saved && S.mode === "internet" && location.hash !== "#camera") connect();

  return session;
}
