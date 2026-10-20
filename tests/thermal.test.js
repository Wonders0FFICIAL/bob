const test = require("node:test");
const assert = require("node:assert/strict");

let thermal;
test.before(async () => {
  thermal = await import("../js/features/thermal.js");
});

test("every palette returns valid colours across the range", () => {
  for (const p of thermal.PALETTES) {
    for (const v of [-1, 0, 0.3, 0.5, 0.99, 1, 4]) assert.match(p.colour(v), /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/, p.id + " " + v);
    assert.match(p.colour(0.5, 0), /^rgba\(\d{1,3},\d{1,3},\d{1,3},0\)$/);
  }
});

test("white hot runs dark to bright and black hot runs the other way", () => {
  const white = thermal.paletteById("white").colour;
  const black = thermal.paletteById("black").colour;
  assert.equal(white(0), "rgb(5,8,10)");
  assert.equal(white(1), "rgb(255,255,255)");
  assert.equal(black(0), "rgb(255,255,255)");
  assert.equal(black(1), "rgb(5,8,10)");
});

test("unknown palette ids fall back to the first and cycling wraps", () => {
  assert.equal(thermal.paletteById("nope").id, thermal.DEFAULT_PALETTE);
  assert.equal(thermal.paletteById(null).id, thermal.DEFAULT_PALETTE);
  let id = thermal.DEFAULT_PALETTE;
  const seen = [];
  for (let i = 0; i < thermal.PALETTES.length; i++) { id = thermal.nextPalette(id).id; seen.push(id); }
  assert.equal(new Set(seen).size, thermal.PALETTES.length);
  assert.equal(id, thermal.DEFAULT_PALETTE);
});