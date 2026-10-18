const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

let data;
test.before(async () => {
  data = await import("../js/features/model-data.js");
});

function glbPartLabels() {
  const buf = fs.readFileSync(path.join(__dirname, "..", "models", "bob-v2.glb"));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  return json.nodes.map((n) => n.name).filter((n) => n && n !== "Bob v2");
}

test("every part in the model has a colour role", () => {
  const labels = glbPartLabels();
  assert.ok(labels.length > 20);
  for (const label of labels) assert.ok(data.roleOf(label), "no role for " + label);
});

test("every colour scheme styles every role", () => {
  for (const s of data.SCHEMES) {
    for (const role of data.ROLES) {
      const m = s.roles[role];
      assert.ok(m && /^#[0-9A-Fa-f]{6}$/.test(m.color), s.id + " is missing a valid colour for " + role);
    }
  }
});

test("every part belongs to exactly one clickable group, except the tow loop", () => {
  const labels = glbPartLabels();
  for (const label of labels) {
    const hits = data.GROUPS.filter((g) => g.match.test(label));
    if (label === "Tow loop") assert.equal(hits.length, 0);
    else assert.equal(hits.length, 1, label + " matched " + hits.length + " groups");
  }
});

test("each group finds parts in the model and has text to show", () => {
  const labels = glbPartLabels();
  for (const g of data.GROUPS) {
    assert.ok(data.namesIn(g, labels).length > 0, g.id + " matches nothing");
    assert.ok(g.title && g.text.length > 20);
  }
});

test("the default scheme exists and the hybrid scheme overrides the bay colour", () => {
  assert.ok(data.SCHEMES.some((s) => s.id === data.DEFAULT_SCHEME));
  const hybrid = data.SCHEMES.find((s) => s.id === "hybrid");
  assert.notEqual(data.materialFor(hybrid, "Electronics bay").color, data.materialFor(hybrid, "Payload compartment").color);
});

test("the web model stays small", () => {
  const size = fs.statSync(path.join(__dirname, "..", "models", "bob-v2.glb")).size;
  assert.ok(size < 1024 * 1024, "model is " + size + " bytes");
});
