(function () {
  const LK = window.LivekitClient;
  const TOPIC = "bob";
  const CAMERA_ID = "bob-camera";
  const enc = new TextEncoder(), dec = new TextDecoder();

  const codeInput = $("code"), rememberView = $("rememberview");
  const camPanel = $("campanel"), camPreview = $("campreview"), camCode = $("camcode");
  const camMsg = $("cammsg"), camBatt = $("cambatt"), camStart = $("camstart"), camStop = $("camstop");
  const rememberCam = $("remembercam");

  async function getToken(role, code) {
    let r;
    try {
      r = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, code }),
      });
    } catch {
      const e = new Error("Can't reach the server.");
      e.network = true;
      throw e;
    }
    let d = {};
    try { d = await r.json(); } catch {}
    if (!r.ok) {
      const e = new Error(d.error || "Server error (" + r.status + ").");
      e.status = r.status;
      throw e;
    }
    return d;
  }

  function libReady() {
    return !!(LK && LK.Room);
  }

  const send = (room, m, to) => {
    if (!room || room.state !== "connected") return false;
    const opts = { reliable: true, topic: TOPIC };
    if (to) opts.destinationIdentities = [to];
    room.localParticipant.publishData(enc.encode(JSON.stringify(m)), opts).catch(() => {});
    return true;
  };

  const why = (e) => {
    const m = String((e && (e.message || e.name)) || e || "unknown error").replace(/\s+/g, " ").trim();
    return m.length > 140 ? m.slice(0, 140) + "…" : m;
  };

  const parse = (payload, topic, from, wantId) => {
    if (topic !== TOPIC || !from) return null;
    if (wantId && from.identity !== wantId) return null;
    try { return JSON.parse(dec.decode(payload)); } catch { return null; }
  };

  let viewerRoom = null, viewerCode = "", wantViewer = false, viewerTimer = 0;

  const cameraOnline = (room) => [...room.remoteParticipants.values()].some((p) => p.identity === CAMERA_ID);

  function waiting() {
    rtc.hidden = true;
    ph.hidden = false;
    liveSince = null;
    hud.hidden = true;
    elapsedEl.textContent = "00:00:00";
    endSwitch();
    setPlaceholder("Waiting for Bob's camera", "Open this site on the phone on Bob and tap \"Use this device as Bob's camera\".");
    setStatus("off", "Waiting", "Connected to the server. Bob's camera isn't online yet.");
  }

  function viewerFatal(text, badgeText) {
    wantViewer = false;
    clearTimeout(viewerTimer);
    active = null;
    goDark("err", badgeText || "Error", text);
  }

  function viewerRetry(note) {
    clearTimeout(viewerTimer);
    rtc.hidden = true;
    ph.hidden = false;
    liveSince = null;
    hud.hidden = true;
    setPlaceholder("Reconnecting…", "Lost the connection. Trying again.");
    setStatus("err", "Reconnecting…", note || "Lost the connection. Trying again.");
    viewerTimer = setTimeout(joinViewer, 3000);
  }

  async function joinViewer() {
    if (!wantViewer) return;
    let creds;
    try {
      creds = await getToken("viewer", viewerCode);
    } catch (e) {
      if (!wantViewer) return;
      if (e.status === 401) {
        write("bob-view-code", null);
        return viewerFatal("Wrong passcode.", "Denied");
      }
      if (e.status) return viewerFatal(e.message);
      return viewerRetry("Can't reach the server. Retrying…");
    }
    if (!wantViewer) return;

    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    viewerRoom = room;

    room.on(LK.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== "video") return;
      track.attach(rtc);
      rtc.hidden = false;
      ph.hidden = true;
      setStatus("off", "Connecting…", "Receiving video…");
      send(room, { t: "hello" }, CAMERA_ID);
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind !== "video") return;
      track.detach(rtc);
      if (!cameraOnline(room)) waiting();
    });
    room.on(LK.RoomEvent.ParticipantConnected, (p) => {
      if (p.identity === CAMERA_ID) setStatus("off", "Connecting…", "Bob's camera is online.");
    });
    room.on(LK.RoomEvent.ParticipantDisconnected, (p) => {
      if (p.identity === CAMERA_ID) waiting();
    });
    room.on(LK.RoomEvent.DataReceived, (payload, from, kind, topic) => {
      const m = parse(payload, topic, from, CAMERA_ID);
      if (!m) return;
      if (m.t === "caps") setCaps(m);
      else if (m.t === "err") { msg.textContent = String(m.m || "Command failed."); endSwitch(); }
    });
    room.on(LK.RoomEvent.Reconnecting, () => {
      if (viewerRoom === room) setStatus("err", "Reconnecting…", "Connection dropped. Retrying…");
    });
    room.on(LK.RoomEvent.Reconnected, () => {
      if (viewerRoom !== room) return;
      if (!rtc.hidden && rtc.videoWidth) setStatus("live", "Live", "Connected.");
      else if (!cameraOnline(room)) waiting();
    });
    room.on(LK.RoomEvent.Disconnected, () => {
      if (viewerRoom !== room) return;
      viewerRoom = null;
      rtc.srcObject = null;
      if (wantViewer) viewerRetry();
    });

    try {
      await room.connect(creds.url, creds.token);
    } catch (e) {
      console.error("viewer connect failed", e);
      if (viewerRoom === room) viewerRoom = null;
      try { room.disconnect(); } catch {}
      if (wantViewer) viewerRetry("Couldn't join the video channel (" + why(e) + "). Retrying…");
      return;
    }
    if (!wantViewer || viewerRoom !== room) { try { room.disconnect(); } catch {} return; }

    if (rememberView.checked) write("bob-view-code", viewerCode);
    else write("bob-view-code", null);

    if (!cameraOnline(room)) waiting();
  }

  function connectViewer() {
    const code = codeInput.value.trim();
    if (!code) return setStatus("err", "Error", "Enter the passcode first.");
    if (location.protocol === "file:") {
      return setStatus("err", "Error", "Internet mode needs the deployed website. From a file, use Local network mode.");
    }
    if (!libReady()) return setStatus("err", "Error", "The video library didn't load. Reload the page and try again.");
    claim("rtc");
    wantViewer = true;
    viewerCode = code;
    zoom = 0;
    ph.hidden = false;
    setPlaceholder("Connecting…", "Joining Bob's channel.");
    setStatus("off", "Connecting…", "Contacting the server…");
    joinViewer();
  }

  $("connect").addEventListener("click", connectViewer);
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") connectViewer(); });

  rtc.addEventListener("playing", () => {
    if (active === "rtc") goLive();
  });

  let camRoom = null, camTrack = null, camSecret = "", wantCam = false, camTimer = 0, camFront = false;
  let wake = null, battReady = false;
  const preset = () => (LK.VideoPresets && LK.VideoPresets.h720 ? LK.VideoPresets.h720.resolution : undefined);

  function camSay(text, bad) {
    camMsg.textContent = text || "";
    camMsg.classList.toggle("bad", !!bad);
  }

  function camButtons(running) {
    camStart.disabled = running;
    camStop.disabled = !running;
    camCode.disabled = running;
  }

  async function lockScreen() {
    try {
      if (navigator.wakeLock && wantCam && document.visibilityState === "visible") {
        wake = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }

  function releaseScreen() {
    try { if (wake) wake.release(); } catch {}
    wake = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wantCam) lockScreen();
  });

  function watchBattery() {
    if (battReady || !navigator.getBattery) return;
    battReady = true;
    navigator.getBattery().then((b) => {
      const upd = () => { camBatt.textContent = "Battery " + Math.round(b.level * 100) + "%" + (b.charging ? " (charging)" : ""); };
      upd();
      b.addEventListener("levelchange", upd);
      b.addEventListener("chargingchange", upd);
    }).catch(() => {});
  }

  function zoomRange() {
    const t = camTrack && camTrack.mediaStreamTrack;
    const c = t && t.getCapabilities ? t.getCapabilities() : null;
    if (!c || !c.zoom) return null;
    return { min: c.zoom.min, max: Math.min(c.zoom.max, c.zoom.min * 6) };
  }

  const sendCaps = (flipped) => send(camRoom, { t: "caps", front: camFront, zoom: !!zoomRange(), flipped: !!flipped });

  async function doFlip(front) {
    if (!camTrack) return;
    try {
      await camTrack.restartTrack({ facingMode: front ? "user" : "environment", resolution: preset() });
      camFront = front;
    } catch {
      send(camRoom, { t: "err", m: "This phone couldn't switch cameras." });
    }
    sendCaps(true);
  }

  async function doZoom(v) {
    const r = zoomRange();
    if (!r) return;
    const pct = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
    try {
      await camTrack.mediaStreamTrack.applyConstraints({ advanced: [{ zoom: r.min + (r.max - r.min) * pct }] });
    } catch {}
  }

  function teardownCam() {
    clearTimeout(camTimer);
    const room = camRoom;
    camRoom = null;
    camTrack = null;
    camPreview.srcObject = null;
    if (room) { try { room.disconnect(); } catch {} }
  }

  function stopCam(note) {
    wantCam = false;
    teardownCam();
    releaseScreen();
    camButtons(false);
    camSay(note || "Camera stopped.");
  }

  function camRetry(note) {
    teardownCam();
    camSay(note, true);
    camTimer = setTimeout(joinCam, 3000);
  }

  async function joinCam() {
    if (!wantCam) return;
    let creds;
    try {
      creds = await getToken("camera", camSecret);
    } catch (e) {
      if (!wantCam) return;
      if (e.status === 401) {
        write("bob-cam-code", null);
        return stopCam("Wrong passcode.");
      }
      if (e.status) return stopCam(e.message);
      return camRetry("Can't reach the server. Retrying…");
    }
    if (!wantCam) return;

    const room = new LK.Room({ dynacast: true, publishDefaults: { simulcast: true, videoCodec: "vp8" } });
    camRoom = room;

    room.on(LK.RoomEvent.ParticipantConnected, () => sendCaps(false));
    room.on(LK.RoomEvent.DataReceived, (payload, from, kind, topic) => {
      const m = parse(payload, topic, from);
      if (!m) return;
      if (m.t === "hello") sendCaps(false);
      else if (m.t === "flip") doFlip(!!m.front);
      else if (m.t === "zoom") doZoom(m.v);
    });
    room.on(LK.RoomEvent.Reconnecting, () => { if (camRoom === room) camSay("Connection dropped. Retrying…", true); });
    room.on(LK.RoomEvent.Reconnected, () => { if (camRoom === room) { camSay("Streaming to the control room."); sendCaps(false); } });
    room.on(LK.RoomEvent.Disconnected, (reason) => {
      if (camRoom !== room) return;
      if (!wantCam) return;
      if (LK.DisconnectReason && reason === LK.DisconnectReason.DUPLICATE_IDENTITY) {
        return stopCam("Another device took over as Bob's camera.");
      }
      camRetry("Connection lost. Reconnecting…");
    });

    let pub, stage = "server";
    try {
      await room.connect(creds.url, creds.token);
      if (!wantCam || camRoom !== room) { try { room.disconnect(); } catch {} return; }
      stage = "camera";
      pub = await room.localParticipant.setCameraEnabled(true, { facingMode: camFront ? "user" : "environment", resolution: preset() });
    } catch (e) {
      console.error("camera start failed at " + stage, e);
      if (camRoom === room) camRoom = null;
      try { room.disconnect(); } catch {}
      if (!wantCam) return;
      const n = e && e.name;
      if (stage === "camera") {
        if (n === "NotAllowedError" || n === "SecurityError") return stopCam("Camera permission was blocked. Allow it in the browser's site settings, then try again.");
        if (n === "NotFoundError" || n === "OverconstrainedError") return stopCam("No camera was found on this device.");
        if (n === "NotReadableError" || n === "AbortError") return stopCam("The camera didn't start. Close other apps or tabs using it, then try again.");
        return camRetry("The camera failed to start (" + why(e) + "). Retrying…");
      }
      return camRetry("Couldn't join the video server (" + why(e) + "). Retrying…");
    }
    if (!wantCam || camRoom !== room) { try { room.disconnect(); } catch {} return; }

    camTrack = pub && pub.track ? pub.track : null;
    if (camTrack) camTrack.attach(camPreview);

    if (rememberCam.checked) write("bob-cam-code", camSecret);
    else write("bob-cam-code", null);

    lockScreen();
    watchBattery();
    camSay("Streaming to the control room.");
    sendCaps(false);
  }

  function startCam() {
    const code = camCode.value.trim();
    if (!code) return camSay("Enter the camera passcode.", true);
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return camSay("This browser can't use the camera on this page. Open the https site in Chrome.", true);
    }
    if (location.protocol === "file:") return camSay("Open the deployed website on the phone, not a file.", true);
    if (!libReady()) return camSay("The video library didn't load. Reload the page and try again.", true);
    wantCam = true;
    camSecret = code;
    camFront = false;
    camButtons(true);
    camSay("Connecting…");
    joinCam();
  }

  function openCam() {
    camPanel.hidden = false;
    camPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("camopen").addEventListener("click", openCam);
  $("camclose").addEventListener("click", () => {
    stopCam("");
    camPanel.hidden = true;
  });
  camStart.addEventListener("click", startCam);
  camStop.addEventListener("click", () => stopCam());
  camCode.addEventListener("keydown", (e) => { if (e.key === "Enter" && !camStart.disabled) startCam(); });

  window.addEventListener("pagehide", () => {
    wantCam = false;
    wantViewer = false;
    teardownCam();
    if (viewerRoom) { try { viewerRoom.disconnect(); } catch {} }
  });

  window.Live = {
    send(m) {
      if (!viewerRoom || !cameraOnline(viewerRoom)) return false;
      return send(viewerRoom, m, CAMERA_ID);
    },
    stopViewer() {
      wantViewer = false;
      clearTimeout(viewerTimer);
      const room = viewerRoom;
      viewerRoom = null;
      rtc.srcObject = null;
      rtc.style.transform = "";
      if (room) { try { room.disconnect(); } catch {} }
    },
  };

  const savedView = read("bob-view-code");
  const savedCamCode = read("bob-cam-code");
  const asCamera = location.hash === "#camera";

  if (savedView) { codeInput.value = savedView; rememberView.checked = true; }
  if (savedCamCode) { camCode.value = savedCamCode; rememberCam.checked = true; }

  if (asCamera) {
    openCam();
    if (savedCamCode) startCam();
  } else if (savedView && mode === "internet") {
    connectViewer();
  }

  window.addEventListener("hashchange", () => { if (location.hash === "#camera") openCam(); });
})();