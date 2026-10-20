const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

let data;
test.before(async () => {
  data = await import("../js/features/model-data.js");
});

function glbPartLabels(file = "bob-v3.glb") {
  const buf = fs.readFileSync(path.join(__dirname, "..", "models", file));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  return json.nodes.map((n) => n.name).filter((n) => n && n !== "Bob v3" && n !== "Pip");
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

test("every part belongs to exactly one clickable group", () => {
  const labels = glbPartLabels();
  for (const label of labels) {
    const hits = data.GROUPS.filter((g) => g.match.test(label));
    assert.equal(hits.length, 1, label + " matched " + hits.length + " groups");
  }
});

test("each group finds parts in the model and has text to show", () => {
  const labels = glbPartLabels();
  for (const g of data.GROUPS) {
    assert.ok(data.namesIn(g, labels).length > 0, g.id + " matches nothing");
    assert.ok(g.title && g.text.length > 20);
    assert.ok(g.view && Number.isFinite(g.view.azimuth) && g.view.polar > 0.35 && g.view.polar < 1.52, g.id + " needs a camera view");
  }
});

test("the default scheme exists and the accent differs from the shell in every scheme", () => {
  assert.ok(data.SCHEMES.some((s) => s.id === data.DEFAULT_SCHEME));
  for (const s of data.SCHEMES) {
    assert.notEqual(data.materialFor(s, "Outer shell").color, data.materialFor(s, "Fender front left").color, s.id);
  }
});

test("the web models stay small", () => {
  for (const f of ["bob-v3.glb", "pip.glb"]) {
    const size = fs.statSync(path.join(__dirname, "..", "models", f)).size;
    assert.ok(size < 1024 * 1024, f + " is " + size + " bytes");
  }
});

test("Pip parked in the hangar is part of the hangar group", () => {
  const pips = glbPartLabels().filter((l) => l.startsWith("Pip "));
  assert.ok(pips.length > 30);
  const hangar = data.GROUPS.find((g) => g.id === "hangar");
  for (const l of pips) assert.ok(hangar.match.test(l), l + " is not in the hangar group");
});

test("every Pip part has a colour role and exactly one Pip group", () => {
  const labels = glbPartLabels("pip.glb");
  assert.ok(labels.length > 30);
  for (const l of labels) {
    assert.ok(data.roleOf(l), "no role for " + l);
    const hits = data.PIP_GROUPS.filter((g) => g.match.test(l));
    assert.equal(hits.length, 1, l + " matches " + hits.length + " Pip groups");
  }
  for (const g of data.PIP_GROUPS) assert.ok(labels.some((l) => g.match.test(l)), g.id + " finds nothing");
});
