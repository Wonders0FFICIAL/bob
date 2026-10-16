function createFakeLK() {
  const RoomEvent = {
    TrackSubscribed: "trackSubscribed",
    TrackUnsubscribed: "trackUnsubscribed",
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
    DataReceived: "dataReceived",
    Reconnecting: "reconnecting",
    Reconnected: "reconnected",
    Disconnected: "disconnected",
  };
  const DisconnectReason = { CLIENT_INITIATED: 1, DUPLICATE_IDENTITY: 2, SERVER_SHUTDOWN: 3 };
  const VideoPresets = { h720: { resolution: { width: 1280, height: 720, frameRate: 30 } } };

  class Emitter {
    constructor() { this.handlers = {}; }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    emit(ev, ...args) { for (const fn of [...(this.handlers[ev] || [])]) fn(...args); }
  }

  const server = {
    rooms: new Map(),
    connectPlan: [],
    cameraPlan: [],
    all: [],
    reset() {
      this.rooms.clear();
      this.connectPlan.length = 0;
      this.cameraPlan.length = 0;
      this.all.length = 0;
    },
    members(name) {
      if (!this.rooms.has(name)) this.rooms.set(name, new Map());
      return this.rooms.get(name);
    },
    token(room, identity) {
      return room + "|" + identity;
    },
  };

  function fakeTrack(room, opts) {
    const state = { front: false, zoom: 1 };
    const t = {
      kind: "video",
      attached: [],
      restarts: [],
      attach(el) { this.attached.push(el); },
      detach(el) { this.attached = this.attached.filter((x) => x !== el); },
      async restartTrack(c) {
        if (opts.flipFails) throw new Error("no such camera");
        this.restarts.push(c);
        state.front = c.facingMode === "user";
      },
      mediaStreamTrack: {
        constraints: [],
        getCapabilities() { return opts.noZoom ? {} : { zoom: { min: 1, max: 10 } }; },
        async applyConstraints(c) { this.constraints.push(c); },
      },
      state,
    };
    return t;
  }

  class Room extends Emitter {
    constructor(options) {
      super();
      this.options = options;
      this.state = "disconnected";
      this.remoteParticipants = new Map();
      this.sent = [];
      this.identity = null;
      this.roomName = null;
      this.disconnects = 0;
      const self = this;
      this.localParticipant = {
        publishData(data, opts) {
          self.sent.push({ data, opts });
          const m = server.members(self.roomName);
          for (const [id, other] of m) {
            if (other === self) continue;
            if (opts.destinationIdentities && !opts.destinationIdentities.includes(id)) continue;
            other.emit(RoomEvent.DataReceived, data, { identity: self.identity }, 0, opts.topic);
          }
          return Promise.resolve();
        },
        async setCameraEnabled(on, o) {
          const plan = server.cameraPlan.length ? server.cameraPlan.shift() : {};
          if (plan.error) { const e = new Error(plan.error.message || plan.error.name); e.name = plan.error.name; throw e; }
          const track = fakeTrack(self, plan);
          self.publishedTrack = track;
          self.cameraOptions = o;
          const m = server.members(self.roomName);
          for (const other of m.values()) {
            if (other === self) continue;
            other.emit(RoomEvent.TrackSubscribed, { kind: "video", attach() {}, detach() {} }, {}, { identity: self.identity });
          }
          return { track };
        },
      };
      server.all.push(this);
    }

    async connect(url, token) {
      this.url = url;
      this.token = token;
      const plan = server.connectPlan.length ? server.connectPlan.shift() : "ok";
      if (plan !== "ok") throw plan instanceof Error ? plan : new Error(String(plan));
      const [roomName, identity] = String(token).split("|");
      this.roomName = roomName;
      this.identity = identity;
      const m = server.members(roomName);
      const old = m.get(identity);
      if (old) old.kick(DisconnectReason.DUPLICATE_IDENTITY);
      this.state = "connected";
      for (const [id, other] of m) {
        this.remoteParticipants.set(id, { identity: id });
        other.remoteParticipants.set(identity, { identity });
      }
      m.set(identity, this);
      for (const [id, other] of m) {
        if (other !== this) other.emit(RoomEvent.ParticipantConnected, { identity });
      }
    }

    leave(reason) {
      const m = server.members(this.roomName);
      if (m.get(this.identity) === this) m.delete(this.identity);
      this.state = "disconnected";
      for (const other of m.values()) {
        const p = other.remoteParticipants.get(this.identity);
        other.remoteParticipants.delete(this.identity);
        if (p) other.emit(RoomEvent.ParticipantDisconnected, p);
      }
      this.remoteParticipants.clear();
      this.emit(RoomEvent.Disconnected, reason);
    }

    disconnect() {
      this.disconnects += 1;
      if (this.state !== "connected") return;
      this.leave(DisconnectReason.CLIENT_INITIATED);
    }

    kick(reason) {
      if (this.state === "connected") this.leave(reason);
    }

    drop() {
      if (this.state === "connected") this.leave(DisconnectReason.SERVER_SHUTDOWN);
    }

    blip() {
      this.emit(RoomEvent.Reconnecting);
    }

    recovered() {
      this.emit(RoomEvent.Reconnected);
    }
  }

  return { Room, RoomEvent, DisconnectReason, VideoPresets, server };
}

function createClock() {
  let t = 0, id = 0;
  const jobs = new Map();
  return {
    set(fn, ms) { id += 1; jobs.set(id, { fn, at: t + ms }); return id; },
    clear(h) { jobs.delete(h); },
    now: () => t,
    pending: () => jobs.size,
    nextAt() { return jobs.size ? Math.min(...[...jobs.values()].map((j) => j.at)) - t : null; },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        jobs.delete(due[0]);
        t = due[1].at;
        due[1].fn();
        await new Promise((r) => setImmediate(r));
      }
      t = end;
    },
  };
}

module.exports = { createFakeLK, createClock };
