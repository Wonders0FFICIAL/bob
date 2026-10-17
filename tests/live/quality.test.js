const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, settle } = require("./harness");
const { createFakeLK } = require("../fakes/livekit");

test("quality helpers", async () => {
  const q = await import("../../js/live/quality.js");
  assert.deepEqual(q.LEVELS, ["low", "standard", "high"]);
  assert.equal(q.levelOf("high"), "high");
  assert.equal(q.levelOf("ultra"), "standard");
  assert.equal(q.levelOf(undefined), "standard");
  assert.equal(q.isLevel("low"), true);
  assert.equal(q.isLevel("nope"), false);
  assert.equal(q.nextLevel("low"), "standard");
  assert.equal(q.nextLevel("standard"), "high");
  assert.equal(q.nextLevel("high"), "low");
  assert.equal(q.nextLevel("junk"), "high");
  const LK = createFakeLK();
  assert.equal(q.settingsFor(LK, "low").capture.resolution.height, 360);
  assert.equal(q.settingsFor(LK, "standard").capture.resolution.height, 720);
  assert.equal(q.settingsFor(LK, "high").capture.resolution.height, 1080);
  assert.equal(q.settingsFor(LK, "high").publish.videoEncoding.maxBitrate, 3000000);
  assert.deepEqual(q.settingsFor({}, "high"), { capture: {}, publish: {} });
  assert.equal(q.settingsFor({ VideoPresets: { h720: LK.VideoPresets.h720 } }, "high").capture.resolution.height, 720);
});

test("camera starts at standard quality unless told otherwise", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(cam.quality, "standard");
  assert.equal(cam.room.cameraOptions.resolution.height, 720);
  assert.equal(cam.room.publishOptions.videoEncoding.maxBitrate, 1700000);
});

test("camera starts at the remembered quality", async () => {
  for (const [level, height, bitrate] of [["low", 360, 450000], ["high", 1080, 3000000]]) {
    const t = await setup();
    const cam = t.camera({ quality: level });
    await cam.start("cam-a");
    assert.equal(cam.room.cameraOptions.resolution.height, height);
    assert.equal(cam.room.publishOptions.videoEncoding.maxBitrate, bitrate);
    assert.equal(cam.room.cameraOptions.facingMode, "environment");
  }
});

test("a junk remembered quality falls back to standard", async () => {
  const t = await setup();
  const cam = t.camera({ quality: "ultra-mega" });
  assert.equal(cam.quality, "standard");
});

test("viewers learn the camera's quality from its capabilities", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera({ quality: "high" });
  await cam.start("cam-a");
  assert.equal(v.last("caps").quality, "high");
});

test("a viewer can ask for a different quality and the camera republishes", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  const videosBefore = v.count("video");
  v.send({ t: "quality", level: "high" });
  await settle();
  assert.equal(cam.quality, "high");
  const calls = t.LK.server.publishCalls;
  assert.deepEqual(calls.slice(-2).map((c) => c.on), [false, true]);
  assert.equal(calls.at(-1).capture.resolution.height, 1080);
  assert.equal(calls.at(-1).publish.videoEncoding.maxBitrate, 3000000);
  assert.equal(v.count("video-gone"), 1);
  assert.equal(v.count("video"), videosBefore + 1);
  assert.equal(v.last("caps").quality, "high");
  assert.equal(v.last("caps").flipped, true);
  assert.equal(cam.count("quality"), 1);
  assert.equal(cam.last("republished").track, cam.track);
  assert.equal(v.online, true);
});

test("quality changes keep the front or back camera that was selected", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  v.send({ t: "flip", front: true });
  await settle();
  v.send({ t: "quality", level: "low" });
  await settle();
  const last = t.LK.server.publishCalls.at(-1);
  assert.equal(last.capture.facingMode, "user");
  assert.equal(last.capture.resolution.height, 360);
  v.send({ t: "flip", front: false });
  await settle();
  assert.equal(cam.track.restarts.at(-1).resolution.height, 360);
});

test("the person on the phone can change quality too", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  assert.equal(await cam.setQuality("low"), true);
  assert.equal(v.last("caps").quality, "low");
  assert.equal(t.LK.server.publishCalls.at(-1).capture.resolution.height, 360);
});

test("asking for the quality it already has changes nothing but re-reports it", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  const calls = t.LK.server.publishCalls.length;
  const caps = v.count("caps");
  assert.equal(await cam.setQuality("standard"), true);
  assert.equal(t.LK.server.publishCalls.length, calls);
  assert.equal(v.count("caps"), caps + 1);
});

test("unknown quality levels are ignored", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  const calls = t.LK.server.publishCalls.length;
  v.send({ t: "quality", level: "ultra" });
  v.send({ t: "quality", level: { evil: true } });
  v.send({ t: "quality" });
  await settle();
  assert.equal(cam.quality, "standard");
  assert.equal(t.LK.server.publishCalls.length, calls);
  assert.equal(await cam.setQuality("ultra"), false);
});

test("changing quality before the camera is streaming just remembers it", async () => {
  const t = await setup();
  const cam = t.camera();
  assert.equal(await cam.setQuality("high"), true);
  assert.equal(cam.quality, "high");
  assert.equal(cam.last("quality").level, "high");
  await cam.start("cam-a");
  assert.equal(cam.room.cameraOptions.resolution.height, 1080);
});

test("if the phone cannot switch quality it says so, keeps the old quality and keeps streaming", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  const cam = t.camera();
  await cam.start("cam-a");
  t.LK.server.cameraPlan.push({ error: { name: "OverconstrainedError", message: "1080p not supported" } });
  assert.equal(await cam.setQuality("high"), false);
  assert.equal(cam.quality, "standard");
  assert.equal(v.last("command-error"), "This phone couldn't change the video quality.");
  assert.equal(cam.last("quality").level, "standard");
  assert.equal(t.LK.server.publishCalls.at(-1).on, true);
  assert.equal(t.LK.server.publishCalls.at(-1).capture.resolution.height, 720);
  assert.ok(cam.track);
  assert.equal(v.last("caps").quality, "standard");
  assert.equal(cam.room.state, "connected");
});

test("if the camera cannot be restored after a failed switch, it retries instead of going silent", async () => {
  const t = await setup();
  const cam = t.camera();
  await cam.start("cam-a");
  t.LK.server.cameraPlan.push({ error: { name: "Error", message: "first" } }, { error: { name: "Error", message: "second" } });
  assert.equal(await cam.setQuality("high"), false);
  assert.match(cam.says().at(-1), /stopped while changing quality/);
  await t.clock.advance(t.clock.nextAt());
  await settle();
  assert.equal(cam.count("streaming"), 2);
});

test("viewers use the real screen's pixel density so the picture is sharp", async () => {
  const t = await setup();
  const v = t.viewer();
  await v.start("view-a");
  assert.deepEqual(v.room.options.adaptiveStream, { pixelDensity: "screen" });
  assert.equal(v.room.options.dynacast, true);
});
