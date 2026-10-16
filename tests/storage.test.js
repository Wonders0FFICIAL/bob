const test = require("node:test");
const assert = require("node:assert/strict");

function backend() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

const DAY = 24 * 60 * 60 * 1000;

test("saved passcodes round trip and expire", async () => {
  const { makeStorage, MAX_AGE } = await import("../js/storage.js");
  let now = 1_000_000;
  const b = backend();
  const s = makeStorage(b, () => now);
  s.saveSecret("k", "pine-onyx-3460");
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), "pine-onyx-3460");
  now += 13 * DAY;
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), "pine-onyx-3460");
  now += 2 * DAY;
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), null);
  assert.equal(b.m.has("k"), false);
});

test("camera passcodes last longer than viewer passcodes", async () => {
  const { MAX_AGE } = await import("../js/storage.js");
  assert.ok(MAX_AGE.camera > MAX_AGE.viewer);
  assert.equal(MAX_AGE.viewer, 14 * DAY);
  assert.equal(MAX_AGE.camera, 90 * DAY);
});

test("saving again refreshes the clock, so devices in use do not expire", async () => {
  const { makeStorage, MAX_AGE } = await import("../js/storage.js");
  let now = 0;
  const s = makeStorage(backend(), () => now);
  s.saveSecret("k", "abc12345");
  now += 10 * DAY;
  s.saveSecret("k", "abc12345");
  now += 10 * DAY;
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), "abc12345");
});

test("older plain-text saves are migrated, junk is discarded", async () => {
  const { makeStorage, MAX_AGE } = await import("../js/storage.js");
  const b = backend();
  const s = makeStorage(b, () => 5);
  b.setItem("old", "legacy-passcode");
  assert.equal(s.loadSecret("old", MAX_AGE.viewer), "legacy-passcode");
  assert.deepEqual(JSON.parse(b.getItem("old")), { c: "legacy-passcode", t: 5 });
  b.setItem("junk", "{broken");
  assert.equal(s.loadSecret("junk", MAX_AGE.viewer), null);
  assert.equal(b.m.has("junk"), false);
  b.setItem("bad", JSON.stringify({ c: 5, t: "x" }));
  assert.equal(s.loadSecret("bad", MAX_AGE.viewer), null);
  b.setItem("nots", JSON.stringify({ c: "abc12345" }));
  assert.equal(s.loadSecret("nots", MAX_AGE.viewer), null);
});

test("forgetting removes the passcode", async () => {
  const { makeStorage, MAX_AGE } = await import("../js/storage.js");
  const s = makeStorage(backend());
  s.saveSecret("k", "abc12345");
  s.forgetSecret("k");
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), null);
});

test("blocked storage never throws", async () => {
  const { makeStorage, MAX_AGE } = await import("../js/storage.js");
  const boom = () => { throw new Error("denied"); };
  const s = makeStorage({ getItem: boom, setItem: boom, removeItem: boom });
  assert.equal(s.read("k"), null);
  assert.doesNotThrow(() => s.write("k", "v"));
  assert.doesNotThrow(() => s.saveSecret("k", "abc12345"));
  assert.equal(s.loadSecret("k", MAX_AGE.viewer), null);
  assert.doesNotThrow(() => s.forgetSecret("k"));
});
