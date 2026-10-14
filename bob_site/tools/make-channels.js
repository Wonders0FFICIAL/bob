const crypto = require("crypto");

const names = process.argv.slice(2);
if (!names.length) {
  console.log('Usage: node tools/make-channels.js "Team Alpha" "Team Bravo" "Ryan"');
  process.exit(1);
}

const WORDS = "amber arrow badger birch cedar cobalt coral crane delta ember falcon fern flint grove harbor heron indigo jade juniper kestrel lagoon maple marble nova oak onyx otter pebble pine quartz raven reef sage slate spruce summit tundra velvet willow zephyr".split(" ");
const pick = () => WORDS[crypto.randomInt(WORDS.length)];
const code = () => pick() + "-" + pick() + "-" + String(crypto.randomInt(1000, 10000));

const used = new Set();
const unique = () => { let c; do { c = code(); } while (used.has(c)); used.add(c); return c; };

const seen = new Set();
const list = names.map((n) => {
  let id = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "ch";
  let base = id, i = 2;
  while (seen.has(id)) id = base.slice(0, 29) + "-" + i++;
  seen.add(id);
  return { id, name: n, camera: unique(), viewer: unique() };
});

console.log("\nPaste this whole line as the value of BOB_CHANNELS in Vercel:\n");
console.log(JSON.stringify(list));
console.log("\nHand these out (keep this table private):\n");
for (const c of list) {
  console.log(c.name.padEnd(20) + "  phone: " + c.camera.padEnd(24) + "  laptop: " + c.viewer);
}
console.log("");