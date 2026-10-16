const test = require("node:test");
const assert = require("node:assert/strict");
const { memoryStore, redisStore, storeFromEnv } = require("../../api/_lib/ratelimit");
const { makeEnv } = require("../../api/_lib/env");
const { clientIp, sameOrigin } = require("../../api/_lib/http");

test("memory store counts and expires", async () => {
  let t = 0;
  const s = memoryStore(() => t);
  assert.deepEqual(await s.get("k"), { count: 0, ttl: 0 });
  assert.equal((await s.incr("k", 10)).count, 1);
  assert.equal((await s.incr("k", 10)).count, 2);
  assert.equal((await s.get("k")).count, 2);
  t += 11_000;
  assert.equal((await s.get("k")).count, 0);
  assert.equal((await s.incr("k", 10)).count, 1);
});

test("redis store sends the expected pipeline and reads results", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const cmds = JSON.parse(init.body);
    if (cmds[0][0] === "SET") return { ok: true, json: async () => [{ result: "OK" }, { result: 3 }, { result: 540 }] };
    return { ok: true, json: async () => [{ result: "3" }, { result: 540 }] };
  };
  const s = redisStore("https://r.example.io/", "tok", fakeFetch);
  const inc = await s.incr("bob:fail:1.1.1.1", 900);
  assert.deepEqual(inc, { count: 3, ttl: 540 });
  assert.equal(calls[0].url, "https://r.example.io/pipeline");
  assert.equal(calls[0].auth, "Bearer tok");
  assert.deepEqual(calls[0].body[0], ["SET", "bob:fail:1.1.1.1", "0", "EX", "900", "NX"]);
  assert.deepEqual(await s.get("bob:fail:1.1.1.1"), { count: 3, ttl: 540 });
});

test("redis store surfaces HTTP and command errors", async () => {
  const bad = redisStore("https://r.example.io", "t", async () => ({ ok: false, status: 500, json: async () => ({}) }));
  await assert.rejects(() => bad.get("k"), /500/);
  const cmdErr = redisStore("https://r.example.io", "t", async () => ({ ok: true, json: async () => [{ error: "WRONGTYPE" }] }));
  await assert.rejects(() => cmdErr.get("k"), /WRONGTYPE/);
});

test("storeFromEnv picks Upstash or Vercel KV variables, otherwise nothing", () => {
  assert.equal(storeFromEnv(makeEnv({})), null);
  assert.equal(storeFromEnv(makeEnv({ UPSTASH_REDIS_REST_URL: "https://a", UPSTASH_REDIS_REST_TOKEN: "t" })).kind, "redis");
  assert.equal(storeFromEnv(makeEnv({ KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "t" })).kind, "redis");
  assert.equal(storeFromEnv(makeEnv({ KV_REST_API_URL: "https://a" })), null);
});

test("clientIp prefers platform headers over spoofable ones", () => {
  assert.equal(clientIp({ headers: { "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6" } }), "1.1.1.1");
  assert.equal(clientIp({ headers: { "x-real-ip": "2.2.2.2" } }), "2.2.2.2");
  assert.equal(clientIp({ headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" } }), "3.3.3.3");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "5.5.5.5" } }), "5.5.5.5");
  assert.equal(clientIp({ headers: {} }), "unknown");
});

test("sameOrigin handles missing, matching, foreign and malformed origins", () => {
  const req = (origin, host = "bob.example.org") => ({ headers: { host, ...(origin ? { origin } : {}) } });
  assert.equal(sameOrigin(req(null)), true);
  assert.equal(sameOrigin(req("https://bob.example.org")), true);
  assert.equal(sameOrigin(req("https://evil.example")), false);
  assert.equal(sameOrigin(req("null")), false);
  assert.equal(sameOrigin(req("https://x.example"), ["https://x.example"]), true);
});
