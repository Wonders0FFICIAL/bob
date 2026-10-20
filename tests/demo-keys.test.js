const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

let keys;
test.before(async () => {
  keys = await import("../js/features/demo-keys.js");
});

test("mission, pip, view and thermal keys map to actions", () => {
  const expected = { "1": "fire", "2": "survivor", "3": "base", "4": "pip", "5": "piphold", p: "piphold", P: "piphold", " ": "stop", "0": "stop", R: "reset", v: "cycleview", m: "viewmap", b: "viewbob", t: "viewpip", i: "inset", x: "swap", c: "palette", "?": "help", h: "help", Escape: "closehelp", "+": "zoomin", "-": "zoomout" };
  for (const [key, action] of Object.entries(expected)) assert.equal(keys.actionFor(key), action, key);
});

test("unbound keys and inherited object names do nothing", () => {
  for (const key of ["q", "Enter", "toString", "constructor", "__proto__"]) assert.equal(keys.actionFor(key), null, key);
});

test("WASD and arrows both drive, by physical key", () => {
  assert.equal(keys.driveKeyFor("KeyW"), "ArrowUp");
  assert.equal(keys.driveKeyFor("KeyA"), "ArrowLeft");
  assert.equal(keys.driveKeyFor("KeyS"), "ArrowDown");
  assert.equal(keys.driveKeyFor("KeyD"), "ArrowRight");
  assert.equal(keys.driveKeyFor("ArrowLeft"), "ArrowLeft");
  assert.equal(keys.driveKeyFor("KeyQ"), null);
});

test("driving letters are never also command keys", () => {
  for (const letter of ["w", "a", "s", "d"]) assert.equal(keys.actionFor(letter), null, letter);
});

test("every action has a handler in the demo and every panel command exists", () => {
  const demo = fs.readFileSync(path.join(__dirname, "..", "js/features/demo.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  for (const name of keys.ACTION_NAMES) assert.match(demo, new RegExp("\\n    " + name + "\\(\\) \\{"), "no handler for " + name);
  for (const m of html.matchAll(/data-cmd="([^"]+)"/g)) assert.match(demo, new RegExp("\\n    " + m[1] + "\\(\\) \\{"), "button without handler: " + m[1]);
});

test("the help list is filled in", () => {
  assert.ok(keys.HELP.length >= 10);
  for (const [k, what] of keys.HELP) assert.ok(k && what);
});