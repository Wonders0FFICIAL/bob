import { parse, sendData, why, zoomRange, zoomValue } from "./protocol.js";
import { retryDelay, STABLE_MS } from "./backoff.js";

export class CameraSession {
  constructor({ LK, getToken, emit, timers, random }) {
    this.LK = LK;
    this.getToken = getToken;
    this.emit = emit;
    this.timers = timers || { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t), now: () => Date.now() };
    this.random = random || Math.random;
    this.room = null;
    this.track = null;
    this.secret = "";
    this.want = false;
    this.front = false;
    this.timer = 0;
    this.attempt = 0;
    this.joinedAt = 0;
    this.run = 0;
  }

  preset() {
    const p = this.LK.VideoPresets && this.LK.VideoPresets.h720;
    return p ? p.resolution : undefined;
  }

  start(code) {
    this.want = true;
    this.secret = code;
    this.front = false;
    this.attempt = 0;
    this.run += 1;
    this.emit("say", { text: "Connecting…" });
    return this.join();
  }

  teardown() {
    this.timers.clear(this.timer);
    const room = this.room;
    this.room = null;
    this.track = null;
    this.emit("teardown");
    if (room) { try { room.disconnect(); } catch {} }
  }

  stop(note) {
    this.want = false;
    this.run += 1;
    this.teardown();
    this.emit("stopped", { note: note === undefined ? "Camera stopped." : note });
  }

  retry(note, minSeconds) {
    this.teardown();
    const ms = retryDelay(this.attempt, minSeconds, this.random);
    this.attempt += 1;
    this.emit("say", { text: note, bad: true, ms });
    const run = this.run;
    this.timer = this.timers.set(() => { if (run === this.run) this.join(); }, ms);
  }

  zoomRange() {
    return zoomRange(this.track && this.track.mediaStreamTrack);
  }

  sendCaps(flipped) {
    return sendData(this.room, { t: "caps", front: this.front, zoom: !!this.zoomRange(), flipped: !!flipped });
  }

  async flip(front) {
    if (!this.track) return;
    try {
      await this.track.restartTrack({ facingMode: front ? "user" : "environment", resolution: this.preset() });
      this.front = front;
    } catch {
      sendData(this.room, { t: "err", m: "This phone couldn't switch cameras." });
    }
    this.sendCaps(true);
  }

  async zoom(v) {
    const r = this.zoomRange();
    if (!r) return;
    try {
      await this.track.mediaStreamTrack.applyConstraints({ advanced: [{ zoom: zoomValue(r, v) }] });
    } catch {}
  }

  async join() {
    if (!this.want) return;
    const run = this.run;
    let creds;
    try {
      creds = await this.getToken("camera", this.secret);
    } catch (e) {
      if (!this.want || run !== this.run) return;
      if (e.status === 401) {
        this.emit("denied");
        return this.stop("Wrong passcode.");
      }
      if (e.status === 429) return this.retry(e.message, e.retryAfter);
      if (e.retryable) return this.retry(e.network ? "Can't reach the server. Retrying…" : e.message + " Retrying…");
      return this.stop(e.message);
    }
    if (!this.want || run !== this.run) return;
    this.emit("channel", creds.channel || "");

    const LK = this.LK;
    const room = new LK.Room({ dynacast: true, publishDefaults: { simulcast: true, videoCodec: "vp8" } });
    this.room = room;
    const mine = () => this.room === room;

    room.on(LK.RoomEvent.ParticipantConnected, () => { if (mine()) this.sendCaps(false); });
    room.on(LK.RoomEvent.DataReceived, (payload, from, kind, topic) => {
      if (!mine()) return;
      const m = parse(payload, topic, from);
      if (!m) return;
      if (m.t === "hello") this.sendCaps(false);
      else if (m.t === "flip") this.flip(!!m.front);
      else if (m.t === "zoom") this.zoom(m.v);
    });
    room.on(LK.RoomEvent.Reconnecting, () => { if (mine()) this.emit("say", { text: "Connection dropped. Retrying…", bad: true }); });
    room.on(LK.RoomEvent.Reconnected, () => {
      if (!mine()) return;
      this.emit("streaming-note");
      this.sendCaps(false);
    });
    room.on(LK.RoomEvent.Disconnected, (reason) => {
      if (!mine() || !this.want) return;
      if (LK.DisconnectReason && reason === LK.DisconnectReason.DUPLICATE_IDENTITY) {
        return this.stop("Another device took over as Bob's camera.");
      }
      if (this.timers.now() - this.joinedAt > STABLE_MS) this.attempt = 0;
      this.retry("Connection lost. Reconnecting…");
    });

    let pub;
    let stage = "server";
    try {
      await room.connect(creds.url, creds.token);
      if (!this.want || !mine()) { try { room.disconnect(); } catch {} return; }
      stage = "camera";
      pub = await room.localParticipant.setCameraEnabled(true, { facingMode: this.front ? "user" : "environment", resolution: this.preset() });
    } catch (e) {
      if (mine()) this.room = null;
      try { room.disconnect(); } catch {}
      if (!this.want || run !== this.run) return;
      const n = e && e.name;
      if (stage === "camera") {
        if (n === "NotAllowedError" || n === "SecurityError") return this.stop("Camera permission was blocked. Allow it in the browser's site settings, then try again.");
        if (n === "NotFoundError" || n === "OverconstrainedError") return this.stop("No camera was found on this device.");
        if (n === "NotReadableError" || n === "AbortError") return this.stop("The camera didn't start. Close other apps or tabs using it, then try again.");
        return this.retry("The camera failed to start (" + why(e) + "). Retrying…");
      }
      return this.retry("Couldn't join the video server (" + why(e) + "). Retrying…");
    }
    if (!this.want || !mine()) { try { room.disconnect(); } catch {} return; }

    this.joinedAt = this.timers.now();
    this.track = pub && pub.track ? pub.track : null;
    this.emit("streaming", { track: this.track });
    this.sendCaps(false);
  }
}
