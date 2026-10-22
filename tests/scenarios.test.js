const test = require("node:test");
const assert = require("node:assert/strict");

let worlds, sim;
test.before(async () => {
  worlds = await import("../js/scenarios/worlds.js");
  sim = await import("../js/scenarios/sim.js");
});

function run(def, pipOn, limit = 12000) {
  const s = sim.createSim(def, { pipOn });
  sim.runAuto(s);
  let n = 0;
  while (!s.finished && n++ < limit) { sim.step(s); sim.drainEvents(s); }
  return s;
}

test("every survivor is reachable from the base in every scenario", () => {
  for (const def of worlds.SCENARIOS) {
    const s = sim.createSim(def);
    for (const sv of def.survivors) {
      if (sv.island) continue;
      assert.ok(sim.findPath(s, def.base, sv), def.id + ": no path to " + sv.note);
      assert.equal(sim.isBlocked(s, sv.x, sv.y), false, def.id + ": " + sv.note + " is inside an obstacle");
    }
  }
});

test("the base and each survivor sit in free space", () => {
  for (const def of worlds.SCENARIOS) {
    const s = sim.createSim(def);
    assert.equal(sim.isBlocked(s, def.base.x, def.base.y), false, def.id + " base");
  }
});

test("each scenario finishes on its own and finds everyone, with and without Pip", () => {
  for (const def of worlds.SCENARIOS) {
    for (const pipOn of [true, false]) {
      const s = run(def, pipOn);
      assert.ok(s.finished, def.id + " pip " + pipOn + " did not finish");
      const want = pipOn ? def.survivors.length : def.survivors.filter((x) => !x.island).length;
      assert.equal(s.finished.found, want, def.id + " pip " + pipOn + " found the wrong number");
    }
  }
});

test("flood: Bob cannot reach the island survivors, Pip can and drops aid to them", () => {
  const def = worlds.byId("flood");
  const withPip = run(def, true).finished;
  assert.equal(withPip.aided, 3);
  assert.equal(withPip.found, 3);
  assert.ok(run(def, false).finished.found < 3);
});

test("aftershock and flare-up events fire and Bob still finishes", () => {
  for (const id of ["earthquake", "fire"]) {
    const s = run(worlds.byId(id), true);
    assert.ok(s.events !== undefined);
    assert.ok(s.finished, id);
    assert.ok(s.frame >= worlds.byId(id).event.at, id + " event never reached");
  }
});

test("Pip finds people faster than Bob alone in the earthquake and the fire", () => {
  for (const id of ["earthquake", "fire"]) {
    const def = worlds.byId(id);
    assert.ok(run(def, true).finished.located < run(def, false).finished.located, id);
  }
});

test("Pip drops aid when it can fly there and not past the cave-in", () => {
  assert.equal(run(worlds.byId("earthquake"), true).finished.aided, 3);
  assert.equal(run(worlds.byId("tunnel"), true).finished.aided, 0);
  assert.equal(run(worlds.byId("earthquake"), false).finished.aided, 0);
});

test("Pip stays on the open side of the cave-in", () => {
  const def = worlds.byId("tunnel");
  const s = sim.createSim(def);
  sim.launchPip(s);
  let max = 0;
  for (let i = 0; i < 2000 && s.pip; i++) { sim.step(s); max = Math.max(max, s.pip ? s.pip.x : 0); }
  assert.ok(max <= def.flyMaxX + 1, "Pip reached x=" + max);
});

test("Bob never ends up inside an obstacle", () => {
  for (const def of worlds.SCENARIOS) {
    const s = sim.createSim(def);
    sim.runAuto(s);
    for (let i = 0; i < 4000 && !s.finished; i++) {
      sim.step(s);
      assert.equal(sim.isBlocked(s, s.bob.x, s.bob.y), false, def.id + " frame " + i);
    }
  }
});

test("events carry the banners the page shows", () => {
  const s = sim.createSim(worlds.byId("earthquake"));
  sim.runAuto(s);
  const banners = new Set();
  for (let i = 0; i < 6000 && !s.finished; i++) { sim.step(s); for (const e of sim.drainEvents(s)) if (e.banner) banners.add(e.banner); }
  for (const b of ["HEAT SIGNATURE", "SURVIVOR REACHED", "AID DROPPED", "MISSION COMPLETE"]) assert.ok(banners.has(b), "missing " + b);
});
