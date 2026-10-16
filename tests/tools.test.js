const test = require("node:test");
const assert = require("node:assert/strict");
const { build, WORDS, bits } = require("../tools/make-channels");
const { loadChannels } = require("../api/_lib/channels");
const { makeEnv } = require("../api/_lib/env");

test("word list has no duplicates and is long enough", () => {
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.length >= 128);
  assert.ok(bits >= 33);
});

test("generated channels are accepted by the server config loader", () => {
  const list = build(["Team A", "Team A", "Ryan's Bob", "bob3"]);
  assert.deepEqual(list.map((c) => c.id), ["team-a", "team-a-2", "ryan-s-bob", "bob3"]);
  const r = loadChannels(makeEnv({ BOB_CHANNELS: JSON.stringify(list) }));
  assert.equal(r.error, undefined);
  assert.equal(r.list.length, 4);
});

test("every generated passcode is unique", () => {
  const list = build(Array.from({ length: 200 }, (_, i) => "bob" + i));
  const all = list.flatMap((c) => [c.camera, c.viewer]);
  assert.equal(new Set(all).size, all.length);
  for (const c of all) assert.match(c, /^[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
});
