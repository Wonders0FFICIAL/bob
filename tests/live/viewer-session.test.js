const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, httpError, networkError, settle } = require("./harness");

test("viewer joins, waits for the camera, then receives its video", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  assert.deepEqual(v.names().slice(0, 4), ["connecting", "channel", "joined", "waiting"]);
  assert.equal(v.last("channel"), "Team A");

  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(v.count("camera-online"), 1);
  assert.equal(v.count("video"), 1);
  assert.equal(v.count("receiving"), 1);
  const hello = v.room.sent.find((s) => JSON.parse(Buffer.from(s.data)).t === "hello");
  assert.ok(hello);
  assert.deepEqual(hello.opts.destinationIdentities, ["bob-camera"]);
  assert.equal(v.online, true);
});

test("viewer shows waiting when the camera leaves and recovers when it returns", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  cam.room.drop();
  assert.equal(v.last("waiting") !== undefined || v.count("waiting") >= 2, true);
  assert.equal(v.online, false);
  const before = v.count("video");
  const cam2 = t.camera();
  await cam2.start("cam-a");
  assert.equal(v.count("video"), before + 1);
  assert.equal(v.online, true);
});

test("unsubscribing the last video track while the camera is gone shows waiting", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  v.room.emit("trackUnsubscribed", { kind: "video" });
  assert.equal(v.count("video-gone"), 1);
  assert.ok(v.count("waiting") >= 2);
});

test("a dropped connection retries with a fresh token and a new room", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const first = v.room;
  first.drop();
  assert.equal(v.count("dropped"), 1);
  assert.equal(v.count("retry"), 1);
  assert.equal(t.api.calls.length, 1);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(t.api.calls.length, 2);
  assert.notEqual(v.room, first);
  assert.equal(v.room.state, "connected");
  assert.equal(v.count("joined"), 2);
});

test("retry delays grow, are capped, and reset after a stable connection", async () => {
  const t = await setup();
  const v = t.viewer();
  t.api.plan.push(networkError(), networkError(), networkError(), networkError(), networkError(), networkError(), networkError());
  await v.start("view-a");
  const delays = [];
  for (let i = 0; i < 7; i++) {
    delays.push(v.last("retry").ms);
    await t.clock.advance(t.clock.nextAt());
    await settle();
  }
  assert.deepEqual(delays, [3000, 6000, 12000, 24000, 30000, 30000, 30000]);
  assert.equal(v.room.state, "connected");
  await t.clock.advance(31000);
  v.room.drop();
  assert.equal(v.last("retry").ms, 3000);
});

test("quick flapping keeps backing off instead of hammering the server", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const delays = [];
  for (let i = 0; i < 3; i++) {
    v.room.drop();
    delays.push(v.last("retry").ms);
    await t.clock.advance(t.clock.nextAt());
    await settle();
  }
  assert.deepEqual(delays, [3000, 6000, 12000]);
});

test("an expired token on join leads to a fresh token on the next attempt", async () => {
  const t = await setup();
  const v = t.viewer();
  t.LK.server.connectPlan.push(new Error("could not establish signal connection: token is expired"));
  await v.start("view-a");
  assert.equal(v.count("retry"), 1);
  assert.match(v.last("retry").note, /token is expired/);
  const firstToken = t.LK.server.all[0].token;
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(t.api.calls.length, 2);
  assert.equal(v.room.state, "connected");
  assert.equal(v.count("joined"), 1);
  assert.equal(t.LK.server.all[0].token, firstToken);
  assert.ok(t.LK.server.all[0].disconnects >= 1);
});

test("a wrong passcode stops the viewer for good", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("nope");
  const f = v.last("fatal");
  assert.equal(f.text, "Wrong passcode.");
  assert.equal(f.denied, true);
  assert.equal(v.want, false);
  assert.equal(t.clock.pending(), 0);
  await t.clock.advance(120000);
  assert.equal(t.api.calls.length, 1);
});

test("rate limited viewers wait at least as long as the server asks", async () => {
  const t = await setup();
  const v = t.viewer();
  t.api.plan.push(httpError(429, "Too many wrong passcodes. Try again in 15 minutes.", { retryAfter: 900, retryable: true }));
  await v.start("view-a");
  assert.equal(v.last("retry").ms, 900000);
  assert.match(v.last("retry").note, /Too many/);
  await t.clock.advance(899000);
  await settle();
  assert.equal(t.api.calls.length, 1);
  await t.clock.advance(1500);
  await settle();
  assert.equal(t.api.calls.length, 2);
});

test("server configuration errors are fatal, transient server errors are retried", async () => {
  let t = await setup();
  let v = t.viewer();
  t.api.plan.push(httpError(500, "Server is not configured yet. Missing: LIVEKIT_URL."));
  await v.start("view-a");
  assert.match(v.last("fatal").text, /not configured/);
  assert.equal(v.last("fatal").denied, undefined);

  t = await setup();
  v = t.viewer();
  t.api.plan.push(httpError(503, "Server error (503).", { retryable: true }));
  await v.start("view-a");
  assert.equal(v.count("fatal"), 0);
  assert.equal(v.count("retry"), 1);
});

test("offline at start retries quietly and then connects", async () => {
  const t = await setup();
  const v = t.viewer();
  t.api.plan.push(networkError());
  await v.start("view-a");
  assert.match(v.last("retry").note, /Can't reach the server/);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(v.count("joined"), 1);
});

test("stopping while the token is being fetched leaves no room behind", async () => {
  const t = await setup();
  const v = t.viewer();
  let release;
  const gate = new Promise((r) => { release = r; });
  const original = t.api.getToken;
  v.getToken = async (...a) => { await gate; return original(...a); };
  const p = v.start("view-a");
  v.stop();
  release();
  await p;
  assert.equal(t.LK.server.all.length, 0);
  assert.equal(v.count("joined"), 0);
});

test("stopping while connecting disconnects the half-open room", async () => {
  const t = await setup();
  const v = t.viewer();
  const origConnect = t.LK.Room.prototype.connect;
  let release;
  const gate = new Promise((r) => { release = r; });
  t.LK.Room.prototype.connect = async function (...a) { await gate; return origConnect.apply(this, a); };
  const p = v.start("view-a");
  await settle();
  v.stop();
  release();
  await p;
  await settle();
  t.LK.Room.prototype.connect = origConnect;
  assert.equal(v.count("joined"), 0);
  assert.equal(v.room, null);
  assert.equal(t.LK.server.members("ch-a").size, 0);
});

test("restarting with a new passcode ignores the old room's events", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const old = v.room;
  await v.start("view-b");
  assert.notEqual(v.room, old);
  assert.equal(old.state, "disconnected");
  assert.equal(v.last("channel"), "Team B");
  const retries = v.count("retry");
  old.emit("disconnected");
  assert.equal(v.count("retry"), retries);
});

test("reconnecting events: banner while down, live again when video is flowing", async () => {
  const t = await setup();
  let video = false;
  const v = t.viewer({ hasVideo: () => video });
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  video = true;
  v.room.blip();
  assert.equal(v.count("reconnecting"), 1);
  v.room.recovered();
  assert.equal(v.count("live"), 1);
  video = false;
  cam.room.drop();
  v.room.blip();
  v.room.recovered();
  assert.equal(v.count("live"), 1);
});

test("commands only go out while the camera is online and are addressed to it", async () => {
  const t = await setup();
  const v = t.viewer();
  assert.equal(v.send({ t: "flip", front: true }), false);
  await v.start("view-a");
  assert.equal(v.send({ t: "flip", front: true }), false);
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(v.send({ t: "zoom", v: 40 }), true);
  const sent = v.room.sent.pop();
  assert.deepEqual(sent.opts.destinationIdentities, ["bob-camera"]);
  assert.equal(sent.opts.topic, "bob");
});

test("only messages from the camera on the bob topic are trusted", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const msg = (o) => Buffer.from(JSON.stringify(o));
  v.room.emit("dataReceived", msg({ t: "caps", front: true }), { identity: "viewer-9" }, 0, "bob");
  v.room.emit("dataReceived", msg({ t: "caps", front: true }), { identity: "bob-camera" }, 0, "other");
  v.room.emit("dataReceived", Buffer.from("not json"), { identity: "bob-camera" }, 0, "bob");
  v.room.emit("dataReceived", msg({ t: 5 }), { identity: "bob-camera" }, 0, "bob");
  assert.equal(v.count("caps"), 0);
  v.room.emit("dataReceived", msg({ t: "caps", front: true, zoom: true }), { identity: "bob-camera" }, 0, "bob");
  assert.equal(v.count("caps"), 1);
  v.room.emit("dataReceived", msg({ t: "err", m: "This phone couldn't switch cameras." }), { identity: "bob-camera" }, 0, "bob");
  assert.equal(v.last("command-error"), "This phone couldn't switch cameras.");
});

test("several viewers on one channel each get the feed, and commands reach the camera", async () => {
  const t = await setup();
  const viewers = [];
  for (let i = 0; i < 6; i++) {
    const v = t.viewer();
    await v.start("view-a");
    viewers.push(v);
  }
  const cam = t.camera();
  await cam.start("cam-a");
  for (const v of viewers) {
    assert.equal(v.count("video"), 1);
    assert.equal(v.online, true);
  }
  assert.equal(new Set(viewers.map((v) => v.room.identity)).size, 6);
  assert.equal(viewers[3].send({ t: "flip", front: true }), true);
  await settle();
  assert.equal(cam.track.restarts.length, 1);
  assert.equal(cam.track.restarts[0].facingMode, "user");
  for (const v of viewers) assert.equal(v.last("caps").front, true);
  cam.room.drop();
  for (const v of viewers) assert.equal(v.online, false);
});

test("viewers late to the party and viewers leaving do not disturb the others", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  const a = t.viewer();
  const b = t.viewer();
  await a.start("view-a");
  await b.start("view-a");
  assert.equal(a.online && b.online, true);
  a.stop();
  assert.equal(b.online, true);
  assert.equal(cam.room.state, "connected");
});

test("channels are isolated from each other", async () => {
  const t = await setup();
  const va = t.viewer();
  const vb = t.viewer();
  await va.start("view-a");
  await vb.start("view-b");
  const ca = t.camera();
  await ca.start("cam-a");
  assert.equal(va.count("video"), 1);
  assert.equal(vb.count("video"), 0);
  assert.equal(vb.online, false);
  assert.equal(vb.send({ t: "flip", front: true }), false);
  const cb = t.camera();
  await cb.start("cam-b");
  assert.equal(vb.count("video"), 1);
  assert.equal(ca.room.remoteParticipants.has("viewer-2"), false);
  assert.equal(ca.track.restarts.length, 0);
});
