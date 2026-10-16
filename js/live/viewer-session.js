import { CAMERA_ID, parse, sendData, why, cameraOnline } from "./protocol.js";
import { retryDelay, STABLE_MS } from "./backoff.js";

export class ViewerSession {
  constructor({ LK, getToken, emit, hasVideo, timers, random }) {
    this.LK = LK;
    this.getToken = getToken;
    this.emit = emit;
    this.hasVideo = hasVideo || (() => false);
    this.timers = timers || { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t), now: () => Date.now() };
    this.random = random || Math.random;
    this.room = null;
    this.code = "";
    this.want = false;
    this.timer = 0;
    this.attempt = 0;
    this.joinedAt = 0;
    this.run = 0;
  }

  get online() {
    return cameraOnline(this.room);
  }

  start(code) {
    this.stopRoom();
    this.want = true;
    this.code = code;
    this.attempt = 0;
    this.run += 1;
    this.emit("connecting");
    return this.join();
  }

  stop() {
    this.want = false;
    this.run += 1;
    this.timers.clear(this.timer);
    this.stopRoom();
  }

  stopRoom() {
    const room = this.room;
    this.room = null;
    if (room) { try { room.disconnect(); } catch {} }
  }

  send(m) {
    if (!this.room || !this.online) return false;
    return sendData(this.room, m, CAMERA_ID);
  }

  fatal(text, extra) {
    this.want = false;
    this.timers.clear(this.timer);
    this.emit("fatal", { text, ...extra });
  }

  retry(note, minSeconds) {
    this.timers.clear(this.timer);
    const ms = retryDelay(this.attempt, minSeconds, this.random);
    this.attempt += 1;
    this.emit("retry", { note: note || "Lost the connection. Trying again.", ms });
    const run = this.run;
    this.timer = this.timers.set(() => { if (run === this.run) this.join(); }, ms);
  }

  async join() {
    if (!this.want) return;
    const run = this.run;
    let creds;
    try {
      creds = await this.getToken("viewer", this.code);
    } catch (e) {
      if (!this.want || run !== this.run) return;
      if (e.status === 401) return this.fatal("Wrong passcode.", { badge: "Denied", denied: true });
      if (e.status === 429) return this.retry(e.message, e.retryAfter);
      if (e.retryable) return this.retry(e.network ? "Can't reach the server. Retrying…" : e.message + " Retrying…");
      return this.fatal(e.message);
    }
    if (!this.want || run !== this.run) return;
    this.emit("channel", creds.channel || "");

    const LK = this.LK;
    const room = new LK.Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    const mine = () => this.room === room;

    room.on(LK.RoomEvent.TrackSubscribed, (track) => {
      if (!mine() || track.kind !== "video") return;
      this.emit("video", { track });
      this.emit("receiving");
      sendData(room, { t: "hello" }, CAMERA_ID);
    });
    room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      if (!mine() || track.kind !== "video") return;
      this.emit("video-gone", { track });
      if (!cameraOnline(room)) this.emit("waiting");
    });
    room.on(LK.RoomEvent.ParticipantConnected, (p) => {
      if (mine() && p.identity === CAMERA_ID) this.emit("camera-online");
    });
    room.on(LK.RoomEvent.ParticipantDisconnected, (p) => {
      if (mine() && p.identity === CAMERA_ID) this.emit("waiting");
    });
    room.on(LK.RoomEvent.DataReceived, (payload, from, kind, topic) => {
      if (!mine()) return;
      const m = parse(payload, topic, from, CAMERA_ID);
      if (!m) return;
      if (m.t === "caps") this.emit("caps", m);
      else if (m.t === "err") this.emit("command-error", String(m.m || "Command failed."));
    });
    room.on(LK.RoomEvent.Reconnecting, () => { if (mine()) this.emit("reconnecting"); });
    room.on(LK.RoomEvent.Reconnected, () => {
      if (!mine()) return;
      if (this.hasVideo()) this.emit("live");
      else if (!cameraOnline(room)) this.emit("waiting");
    });
    room.on(LK.RoomEvent.Disconnected, () => {
      if (!mine()) return;
      this.room = null;
      this.emit("dropped");
      if (!this.want) return;
      if (this.timers.now() - this.joinedAt > STABLE_MS) this.attempt = 0;
      this.retry();
    });

    try {
      await room.connect(creds.url, creds.token);
    } catch (e) {
      if (mine()) this.room = null;
      try { room.disconnect(); } catch {}
      if (this.want && run === this.run) this.retry("Couldn't join the video channel (" + why(e) + "). Retrying…");
      return;
    }
    if (!this.want || !mine()) { try { room.disconnect(); } catch {} return; }

    this.joinedAt = this.timers.now();
    this.emit("joined");
    if (!cameraOnline(room)) this.emit("waiting");
  }
}
