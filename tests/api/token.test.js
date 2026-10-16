const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../../api/token");
const { createLimiter, memoryStore } = require("../../api/_lib/ratelimit");
const { CHANNELS, mockRes, mockReq, jwt, envWith } = require("../helpers");

function make(extraEnv = {}, opts = {}) {
  const store = memoryStore(opts.now);
  const limiter = createLimiter({ fallback: store, options: opts.limits });
  return { handler: createHandler({ getEnv: envWith({ BOB_CHANNELS: CHANNELS, ...extraEnv }), limiter, delay: 0 }), store };
}

async function call(handler, body, extra) {
  const res = mockRes();
  await handler(mockReq(body, extra), res);
  return res;
}

test("camera passcode returns a publish token for its own room", async () => {
  const { handler } = make();
  const r = await call(handler, { role: "camera", code: "pine-onyx-3460" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.channel, "Bob One");
  assert.equal(r.body.identity, "bob-camera");
  assert.equal(r.body.url, "wss://demo.livekit.cloud");
  const g = jwt(r.body.token).video;
  assert.equal(g.room, "ch-bob1");
  assert.equal(g.canPublish, true);
  assert.equal(g.canSubscribe, true);
});

test("viewer passcode returns a subscribe-only token", async () => {
  const { handler } = make();
  const r = await call(handler, { role: "viewer", code: "kestrel-juniper-9776" });
  assert.equal(r.statusCode, 200);
  const g = jwt(r.body.token).video;
  assert.equal(g.room, "ch-bob2");
  assert.equal(g.canPublish, false);
  assert.match(r.body.identity, /^viewer-[0-9a-f]{8}$/);
});

test("passcodes ignore case, spaces and dashes", async () => {
  const { handler } = make();
  const r = await call(handler, { role: "camera", code: "  PINE onyx 3460 " });
  assert.equal(r.statusCode, 200);
});

test("a viewer passcode cannot be used as a camera passcode", async () => {
  const { handler } = make();
  const r = await call(handler, { role: "camera", code: "juniper-badger-8692" });
  assert.equal(r.statusCode, 401);
});

test("tokens are short lived", async () => {
  const { handler } = make();
  const r = await call(handler, { role: "viewer", code: "juniper-badger-8692" });
  const p = jwt(r.body.token);
  assert.ok(p.exp - p.nbf <= 30 * 60 + 5);
  assert.ok(p.exp - p.nbf >= 29 * 60);
});

test("BOB_TOKEN_TTL overrides the lifetime, bad values are ignored", async () => {
  let h = make({ BOB_TOKEN_TTL: "5m" }).handler;
  let p = jwt((await call(h, { role: "viewer", code: "juniper-badger-8692" })).body.token);
  assert.equal(p.exp - p.nbf, 300);
  h = make({ BOB_TOKEN_TTL: "forever" }).handler;
  p = jwt((await call(h, { role: "viewer", code: "juniper-badger-8692" })).body.token);
  assert.equal(p.exp - p.nbf, 1800);
});

test("non-POST, bad role and empty code are rejected", async () => {
  const { handler } = make();
  const get = mockRes();
  await handler({ method: "GET", headers: {} }, get);
  assert.equal(get.statusCode, 405);
  assert.equal((await call(handler, { role: "admin", code: "x" })).statusCode, 400);
  assert.equal((await call(handler, { role: "viewer", code: "   " })).statusCode, 400);
  assert.equal((await call(handler, { role: "viewer", code: "x".repeat(500) })).statusCode, 400);
  assert.equal((await call(handler, "not json")).statusCode, 400);
});

test("string bodies are parsed", async () => {
  const { handler } = make();
  const r = await call(handler, JSON.stringify({ role: "viewer", code: "juniper-badger-8692" }));
  assert.equal(r.statusCode, 200);
});

test("cross-site requests are refused, same-site and tool requests pass", async () => {
  const { handler } = make();
  const body = { role: "viewer", code: "juniper-badger-8692" };
  const evil = await call(handler, body, { headers: { host: "bob.example.org", origin: "https://evil.example", "x-real-ip": "9.9.9.9" } });
  assert.equal(evil.statusCode, 403);
  const own = await call(handler, body, { headers: { host: "bob.example.org", origin: "https://bob.example.org", "x-real-ip": "9.9.9.9" } });
  assert.equal(own.statusCode, 200);
  const none = await call(handler, body, { headers: { host: "bob.example.org", "x-real-ip": "9.9.9.9" } });
  assert.equal(none.statusCode, 200);
});

test("ALLOWED_ORIGINS lets another site call the API", async () => {
  const { handler } = make({ ALLOWED_ORIGINS: "https://partner.example" });
  const r = await call(handler, { role: "viewer", code: "juniper-badger-8692" }, { headers: { host: "bob.example.org", origin: "https://partner.example", "x-real-ip": "5.5.5.5" } });
  assert.equal(r.statusCode, 200);
});

test("repeated wrong passcodes lock the address out, even for the right passcode", async () => {
  const { handler } = make({}, { limits: { failLimit: 3 } });
  for (let i = 0; i < 3; i++) assert.equal((await call(handler, { role: "viewer", code: "guess" + i + "xxxx" })).statusCode, 401);
  const locked = await call(handler, { role: "viewer", code: "juniper-badger-8692" });
  assert.equal(locked.statusCode, 429);
  assert.ok(Number(locked.headers["Retry-After"]) > 0);
  assert.match(locked.body.error, /Too many wrong passcodes/);
});

test("a lockout is per address, other addresses still work", async () => {
  const { handler } = make({}, { limits: { failLimit: 2 } });
  for (let i = 0; i < 2; i++) await call(handler, { role: "viewer", code: "badbadbad" + i });
  assert.equal((await call(handler, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 429);
  const other = await call(handler, { role: "viewer", code: "juniper-badger-8692" }, { headers: { host: "bob.example.org", "x-real-ip": "8.8.8.8" } });
  assert.equal(other.statusCode, 200);
});

test("successful logins do not reset the failure count", async () => {
  const { handler } = make({}, { limits: { failLimit: 3 } });
  await call(handler, { role: "viewer", code: "badbadbad1" });
  await call(handler, { role: "viewer", code: "badbadbad2" });
  assert.equal((await call(handler, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 200);
  await call(handler, { role: "viewer", code: "badbadbad3" });
  assert.equal((await call(handler, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 429);
});

test("lockout expires after the window", async () => {
  let t = 1_000_000;
  const { handler } = make({}, { now: () => t, limits: { failLimit: 2, failWindow: 600 } });
  for (let i = 0; i < 2; i++) await call(handler, { role: "viewer", code: "badbadbad" + i });
  assert.equal((await call(handler, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 429);
  t += 601_000;
  assert.equal((await call(handler, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 200);
});

test("request flood is limited per minute", async () => {
  const { handler } = make({}, { limits: { requestLimit: 5 } });
  let last;
  for (let i = 0; i < 6; i++) last = await call(handler, { role: "viewer", code: "juniper-badger-8692" });
  assert.equal(last.statusCode, 429);
  assert.match(last.body.error, /Too many requests/);
});

test("configuration problems give readable 500 errors", async () => {
  const run = async (env) => {
    const h = createHandler({ getEnv: envWith(env), limiter: createLimiter({ fallback: memoryStore() }), delay: 0 });
    return call(h, { role: "viewer", code: "juniper-badger-8692" });
  };
  let r = await run({});
  assert.equal(r.statusCode, 500);
  assert.match(r.body.error, /BOB_VIEWER_PASSCODE/);
  r = await run({ BOB_CHANNELS: "{bad" });
  assert.match(r.body.error, /not valid JSON/);
  r = await run({ BOB_CHANNELS: JSON.stringify([{ id: "a", code: "short" }]) });
  assert.match(r.body.error, /shorter than 8/);
  r = await run({ BOB_CHANNELS: JSON.stringify([{ id: "a", code: "longenough1" }, { id: "b", code: "LONG-ENOUGH-1" }]) });
  assert.match(r.body.error, /share a/);
  r = await run({ BOB_CHANNELS: JSON.stringify([{ id: "A B", code: "longenough1" }]) });
  assert.match(r.body.error, /id of 1 to 32/);
  r = await run({ BOB_CHANNELS: JSON.stringify([{ id: "a", code: "longenough1" }, { id: "a", code: "longenough2" }]) });
  assert.match(r.body.error, /used twice/);
  r = await run({ LIVEKIT_URL: "nonsense value", BOB_CHANNELS: CHANNELS });
  assert.match(r.body.error, /LIVEKIT_URL looks wrong/);
});

test("legacy two-passcode setup still works in a single room", async () => {
  const h = createHandler({ getEnv: envWith({ BOB_VIEWER_PASSCODE: "legacy-view-1", BOB_CAMERA_PASSCODE: "legacy-cam-1" }), limiter: createLimiter({ fallback: memoryStore() }), delay: 0 });
  const r = await call(h, { role: "viewer", code: "legacy-view-1" });
  assert.equal(r.statusCode, 200);
  assert.equal(jwt(r.body.token).video.room, "bob");
});

test("environment values with quotes and spaces are cleaned", async () => {
  const h = createHandler({ getEnv: envWith({ LIVEKIT_URL: ' "https://demo.livekit.cloud/" ', BOB_CHANNELS: CHANNELS }), limiter: createLimiter({ fallback: memoryStore() }), delay: 0 });
  const r = await call(h, { role: "viewer", code: "juniper-badger-8692" });
  assert.equal(r.body.url, "wss://demo.livekit.cloud");
});

test("if the shared rate limit store fails, requests still get limited in memory", async () => {
  const broken = { kind: "redis", get: async () => { throw new Error("down"); }, incr: async () => { throw new Error("down"); } };
  const errors = [];
  const limiter = createLimiter({ primary: broken, fallback: memoryStore(), options: { failLimit: 2 }, onError: (e) => errors.push(e.message) });
  const h = createHandler({ getEnv: envWith({ BOB_CHANNELS: CHANNELS }), limiter, delay: 0 });
  for (let i = 0; i < 2; i++) await call(h, { role: "viewer", code: "badbadbad" + i });
  assert.equal((await call(h, { role: "viewer", code: "juniper-badger-8692" })).statusCode, 429);
  assert.ok(errors.length > 0);
});
