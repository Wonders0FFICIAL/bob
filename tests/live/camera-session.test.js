const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, httpError, networkError, settle } = require("./harness");

test("camera joins, publishes, and tells viewers what it can do", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(cam.last("channel"), "Team A");
  assert.equal(cam.count("streaming"), 1);
  assert.equal(cam.room.cameraOptions.facingMode, "environment");
  assert.equal(cam.room.cameraOptions.resolution.height, 720);
  assert.equal(v.last("caps").zoom, true);
  assert.equal(v.last("caps").front, false);
});

test("a viewer joining later gets the camera's capabilities after saying hello", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  const v = t.viewer();
  await v.start("view-a");
  assert.ok(v.count("caps") >= 1);
});

test("flipping to the front camera restarts the track and reports back", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  v.send({ t: "flip", front: true });
  await settle();
  assert.equal(cam.front, true);
  assert.equal(v.last("caps").front, true);
  assert.equal(v.last("caps").flipped, true);
  v.send({ t: "flip", front: false });
  await settle();
  assert.equal(cam.front, false);
  assert.equal(cam.track.restarts.at(-1).facingMode, "environment");
});

test("a failed camera switch is reported and the old camera stays selected", async () => {
  const t = await setup();
  t.LK.server.cameraPlan.push({ flipFails: true });
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  v.send({ t: "flip", front: true });
  await settle();
  assert.equal(cam.front, false);
  assert.equal(v.last("command-error"), "This phone couldn't switch cameras.");
  assert.equal(v.last("caps").flipped, true);
});

test("zoom maps 0 to 100 percent onto the hardware range, capped at six times", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  v.send({ t: "zoom", v: 0 });
  v.send({ t: "zoom", v: 100 });
  v.send({ t: "zoom", v: 500 });
  v.send({ t: "zoom", v: "junk" });
  await settle();
  const z = cam.track.mediaStreamTrack.constraints.map((c) => c.advanced[0].zoom);
  assert.deepEqual(z, [1, 6, 6, 1]);
});

test("a phone without hardware zoom says so and ignores zoom commands", async () => {
  const t = await setup();
  t.LK.server.cameraPlan.push({ noZoom: true });
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(v.last("caps").zoom, false);
  v.send({ t: "zoom", v: 50 });
  await settle();
  assert.equal(cam.track.mediaStreamTrack.constraints.length, 0);
});

test("camera permission and hardware problems stop with a clear message", async () => {
  const cases = [
    [{ name: "NotAllowedError" }, /permission was blocked/],
    [{ name: "SecurityError" }, /permission was blocked/],
    [{ name: "NotFoundError" }, /No camera was found/],
    [{ name: "OverconstrainedError" }, /No camera was found/],
    [{ name: "NotReadableError" }, /didn't start/],
    [{ name: "AbortError" }, /didn't start/],
  ];
  for (const [error, pattern] of cases) {
    const t = await setup();
    t.LK.server.cameraPlan.push({ error });
    const cam = t.camera();
    await cam.start("cam-a");
    assert.match(cam.last("stopped").note, pattern, error.name);
    assert.equal(cam.want, false);
    assert.equal(t.clock.pending(), 0);
    assert.equal(t.LK.server.members("ch-a").size, 0);
  }
});

test("an unknown camera failure is retried, not given up on", async () => {
  const t = await setup();
  t.LK.server.cameraPlan.push({ error: { name: "Error", message: "weird glitch" } });
  const cam = t.camera();
  await cam.start("cam-a");
  assert.match(cam.says().at(-1), /camera failed to start \(weird glitch\)/);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(cam.count("streaming"), 1);
});

test("server trouble while joining is retried with growing delays", async () => {
  const t = await setup();
  t.LK.server.connectPlan.push(new Error("signal failed"), new Error("signal failed"), new Error("signal failed"));
  const cam = t.camera();
  await cam.start("cam-a");
  const ms = [cam.last("say").ms];
  for (let i = 0; i < 2; i++) {
    await t.clock.advance(t.clock.nextAt());
    await settle();
    ms.push(cam.last("say").ms);
  }
  assert.deepEqual(ms, [3000, 6000, 12000]);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(cam.count("streaming"), 1);
});

test("a wrong passcode on the camera forgets it and stops", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("view-a");
  assert.equal(cam.count("denied"), 1);
  assert.equal(cam.last("stopped").note, "Wrong passcode.");
  assert.equal(cam.want, false);
});

test("a rate limited camera waits as long as the server says", async () => {
  const t = await setup();
  t.api.plan.push(httpError(429, "Too many requests. Wait a moment and try again.", { retryAfter: 45, retryable: true }));
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(cam.last("say").ms, 45000);
  await t.clock.advance(45000);
  await settle();
  assert.equal(cam.count("streaming"), 1);
});

test("camera drops and reconnects with a fresh token", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  const first = cam.room;
  first.drop();
  assert.equal(v.online, false);
  assert.match(cam.says().at(-1), /Connection lost/);
  assert.equal(t.api.calls.filter((c) => c.role === "camera").length, 1);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(t.api.calls.filter((c) => c.role === "camera").length, 2);
  assert.notEqual(cam.room, first);
  assert.equal(cam.count("streaming"), 2);
  assert.equal(v.online, true);
});

test("a brief network blip on the camera recovers without rejoining", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  cam.room.blip();
  assert.equal(cam.says().at(-1), "Connection dropped. Retrying…");
  cam.room.recovered();
  assert.equal(cam.count("streaming-note"), 1);
  assert.equal(t.api.calls.length, 1);
});

test("swapping phones: the new camera takes over and the old one stops without fighting back", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const phoneOne = t.camera();
  await phoneOne.start("cam-a");
  const phoneTwo = t.camera();
  await phoneTwo.start("cam-a");
  assert.equal(phoneOne.want, false);
  assert.equal(phoneOne.last("stopped").note, "Another device took over as Bob's camera.");
  assert.equal(phoneOne.room, null);
  await t.clock.advance(120000);
  await settle();
  assert.equal(t.api.calls.filter((c) => c.role === "camera").length, 2);
  assert.equal(phoneTwo.room.state, "connected");
  assert.equal(v.online, true);
  assert.ok(v.count("video") >= 2);
});

test("stopping the camera disconnects and cancels pending retries", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  cam.room.drop();
  assert.equal(t.clock.pending(), 1);
  cam.stop();
  assert.equal(t.clock.pending(), 0);
  assert.equal(cam.last("stopped").note, "Camera stopped.");
  await t.clock.advance(60000);
  await settle();
  assert.equal(t.api.calls.length, 1);
});

test("stopping the camera while it is still joining does not leave it published", async () => {
  const t = await setup();
  const cam = t.camera();
  const orig = t.LK.Room.prototype.connect;
  let release;
  const gate = new Promise((r) => { release = r; });
  t.LK.Room.prototype.connect = async function (...a) { await gate; return orig.apply(this, a); };
  const p = cam.start("cam-a");
  await settle();
  cam.stop();
  release();
  await p;
  await settle();
  t.LK.Room.prototype.connect = orig;
  assert.equal(cam.count("streaming"), 0);
  assert.equal(t.LK.server.members("ch-a").size, 0);
});

test("camera messages from strangers on other topics are ignored", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  cam.room.emit("dataReceived", Buffer.from(JSON.stringify({ t: "flip", front: true })), { identity: "x" }, 0, "other");
  cam.room.emit("dataReceived", Buffer.from("garbage"), { identity: "x" }, 0, "bob");
  await settle();
  assert.equal(cam.front, false);
  assert.equal(cam.track.restarts.length, 0);
});

test("an expired token when the camera tries to rejoin is replaced by a fresh one", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  cam.room.drop();
  t.LK.server.connectPlan.push(new Error("token is expired"));
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.match(cam.says().at(-1), /token is expired/);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(cam.count("streaming"), 2);
  assert.equal(t.api.calls.filter((c) => c.role === "camera").length, 3);
});

test("offline camera keeps trying quietly", async () => {
  const t = await setup();
  t.api.plan.push(networkError(), networkError());
  const cam = t.camera();
  await cam.start("cam-a");
  assert.match(cam.says().at(-1), /Can't reach the server/);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(cam.count("streaming"), 1);
});
