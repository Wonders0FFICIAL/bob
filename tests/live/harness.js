const { createFakeLK, createClock } = require("../fakes/livekit");

function makeTokenApi(server) {
  const api = {
    calls: [],
    plan: [],
    codes: { "view-a": { room: "ch-a", role: "viewer", channel: "Team A" }, "cam-a": { room: "ch-a", role: "camera", channel: "Team A" }, "view-b": { room: "ch-b", role: "viewer", channel: "Team B" }, "cam-b": { room: "ch-b", role: "camera", channel: "Team B" } },
    viewers: 0,
    async getToken(role, code) {
      api.calls.push({ role, code });
      const planned = api.plan.length ? api.plan.shift() : null;
      if (planned) throw planned;
      const c = api.codes[code];
      if (!c || c.role !== role) {
        const e = new Error("Wrong passcode.");
        e.status = 401;
        throw e;
      }
      api.viewers += role === "viewer" ? 1 : 0;
      const identity = role === "camera" ? "bob-camera" : "viewer-" + api.viewers;
      return { token: server.token(c.room, identity), url: "wss://fake.livekit.cloud", identity, channel: c.channel };
    },
  };
  return api;
}

function httpError(status, message, extra = {}) {
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra);
  return e;
}

function networkError() {
  const e = new Error("Can't reach the server.");
  e.network = true;
  e.retryable = true;
  return e;
}

async function settle(n = 6) {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
}

async function setup() {
  const LK = createFakeLK();
  LK.server.reset();
  const clock = createClock();
  const api = makeTokenApi(LK.server);
  const { ViewerSession } = await import("../../js/live/viewer-session.js");
  const { CameraSession } = await import("../../js/live/camera-session.js");
  const { encode } = await import("../../js/live/protocol.js");

  function viewer(opts = {}) {
    const events = [];
    const s = new ViewerSession({
      LK,
      getToken: api.getToken,
      emit: (ev, p) => events.push([ev, p]),
      hasVideo: opts.hasVideo || (() => false),
      timers: clock,
      random: () => 0.5,
    });
    s.events = events;
    s.names = () => events.map((e) => e[0]);
    s.count = (n) => events.filter((e) => e[0] === n).length;
    s.last = (n) => { const m = events.filter((e) => e[0] === n); return m.length ? m[m.length - 1][1] : undefined; };
    return s;
  }

  function camera(opts = {}) {
    const events = [];
    const s = new CameraSession({
      LK,
      quality: opts.quality,
      getToken: api.getToken,
      emit: (ev, p) => events.push([ev, p]),
      timers: clock,
      random: () => 0.5,
    });
    s.events = events;
    s.names = () => events.map((e) => e[0]);
    s.count = (n) => events.filter((e) => e[0] === n).length;
    s.last = (n) => { const m = events.filter((e) => e[0] === n); return m.length ? m[m.length - 1][1] : undefined; };
    s.says = () => events.filter((e) => e[0] === "say").map((e) => e[1].text);
    return s;
  }

  return { LK, clock, api, viewer, camera, encode, settle };
}

module.exports = { setup, httpError, networkError, settle };
