const test = require("node:test");
const assert = require("node:assert/strict");

test("backoff", async () => {
  const { nextDelay, retryDelay } = await import("../js/live/backoff.js");
  assert.equal(nextDelay(0, () => 0.5), 3000);
  assert.equal(nextDelay(1, () => 0.5), 6000);
  assert.equal(nextDelay(10, () => 0.5), 30000);
  assert.equal(nextDelay(-3, () => 0.5), 3000);
  assert.equal(nextDelay(0, () => 0), 2250);
  assert.equal(nextDelay(0, () => 1), 3750);
  assert.equal(retryDelay(0, 20, () => 0.5), 20000);
  assert.equal(retryDelay(4, 2, () => 0.5), 30000);
  assert.equal(retryDelay(0, 0, () => 0.5), 3000);
});

test("protocol helpers", async () => {
  const p = await import("../js/live/protocol.js");
  const bytes = p.encode({ t: "hello" });
  assert.deepEqual(p.parse(bytes, "bob", { identity: "a" }), { t: "hello" });
  assert.equal(p.parse(bytes, "nope", { identity: "a" }), null);
  assert.equal(p.parse(bytes, "bob", null), null);
  assert.equal(p.parse(bytes, "bob", { identity: "a" }, "b"), null);
  assert.equal(p.parse(p.encode([1]), "bob", { identity: "a" }), null);
  assert.equal(p.why(new Error("  lots   of\nspace ")), "lots of space");
  assert.equal(p.why("x".repeat(300)).length, 141);
  assert.equal(p.why(null), "unknown error");
  assert.equal(p.zoomRange({ getCapabilities: () => ({}) }), null);
  assert.equal(p.zoomRange(null), null);
  assert.deepEqual(p.zoomRange({ getCapabilities: () => ({ zoom: { min: 1, max: 3 } }) }), { min: 1, max: 3 });
  assert.deepEqual(p.zoomRange({ getCapabilities: () => ({ zoom: { min: 1, max: 30 } }) }), { min: 1, max: 6 });
  assert.equal(p.zoomValue({ min: 1, max: 6 }, 50), 3.5);
  assert.equal(p.zoomValue({ min: 1, max: 6 }, -5), 1);
  assert.equal(p.sendData({ state: "disconnected" }, {}), false);
  assert.equal(p.sendData(null, {}), false);
  let got;
  const room = { state: "connected", localParticipant: { publishData: (d, o) => { got = o; return Promise.reject(new Error("x")); } } };
  assert.equal(p.sendData(room, { t: "x" }, "bob-camera"), true);
  assert.deepEqual(got.destinationIdentities, ["bob-camera"]);
  await new Promise((r) => setImmediate(r));
});

test("token client classifies server answers", async () => {
  const { getToken } = await import("../js/live/token.js");
  const reply = (status, body, headers = {}) => async () => ({ ok: status < 400, status, json: async () => body, headers: { get: (k) => headers[k] ?? null } });

  const ok = await getToken("viewer", "x", reply(200, { token: "t", url: "wss://a", channel: "A" }));
  assert.equal(ok.channel, "A");

  await assert.rejects(() => getToken("viewer", "x", reply(401, { error: "Wrong passcode." })), (e) => e.status === 401 && !e.retryable);
  await assert.rejects(() => getToken("viewer", "x", reply(429, { error: "slow", retryAfter: 30 })), (e) => e.status === 429 && e.retryable && e.retryAfter === 30);
  await assert.rejects(() => getToken("viewer", "x", reply(429, {}, { "Retry-After": "12" })), (e) => e.retryAfter === 12);
  await assert.rejects(() => getToken("viewer", "x", reply(500, { error: "Server is not configured yet." })), (e) => e.status === 500 && !e.retryable);
  await assert.rejects(() => getToken("viewer", "x", reply(502, {})), (e) => e.retryable && /502/.test(e.message));
  await assert.rejects(() => getToken("viewer", "x", reply(403, { error: "Requests from other websites are not allowed." })), (e) => !e.retryable);
  await assert.rejects(() => getToken("viewer", "x", reply(200, {})), (e) => e.retryable);
  await assert.rejects(() => getToken("viewer", "x", async () => { throw new TypeError("fetch failed"); }), (e) => e.network && e.retryable);
});

test("video link parsing", async () => {
  const { youtubeId } = await import("../js/features/video.js").catch(() => ({}));
  if (!youtubeId) return;
  assert.equal(youtubeId("https://youtube.com/shorts/W0G0fOATsiU?si=abc"), "W0G0fOATsiU");
  assert.equal(youtubeId("https://youtu.be/W0G0fOATsiU"), "W0G0fOATsiU");
  assert.equal(youtubeId("W0G0fOATsiU"), "W0G0fOATsiU");
  assert.equal(youtubeId("nonsense"), null);
});
