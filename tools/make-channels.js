const crypto = require("crypto");

const WORDS = ("acorn amber anchor arrow aspen badger basil beacon birch bison bramble breeze bronze cactus canyon cedar cherry cinder clover cobalt comet copper coral cove crane crimson crystal cypress dawn delta dune eagle ember falcon fennel fern finch flint forest fox frost garnet ginger glacier granite grove harbor hazel heron hickory hollow indigo iris ivory jade jasper juniper kelp kestrel lagoon lantern larch lemon lichen lilac linden lotus lunar magnet maple marble meadow mesa mint moss mulberry nectar nickel nova oak oasis olive onyx orchid osprey otter pebble pepper pine plum poplar quartz quill raven reed reef ridge river robin rowan saffron sage sandal sequoia shale silver slate sorrel spruce stone summit sunset thistle thorn thyme tidal timber topaz tulip tundra umber valley velvet violet walnut willow wren yarrow zephyr zinc").split(" ");

const WORD_COUNT = 3;
const DIGITS = 4;
const bits = Math.log2(WORDS.length) * WORD_COUNT + Math.log2(9 * 10 ** (DIGITS - 1));

const pick = () => WORDS[crypto.randomInt(WORDS.length)];
const code = () => {
  const words = [];
  for (let i = 0; i < WORD_COUNT; i++) words.push(pick());
  return words.join("-") + "-" + crypto.randomInt(10 ** (DIGITS - 1), 10 ** DIGITS);
};

function build(names) {
  const used = new Set();
  const unique = () => { let c; do { c = code(); } while (used.has(c)); used.add(c); return c; };
  const seen = new Set();
  return names.map((n) => {
    const base = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "ch";
    let id = base, i = 2;
    while (seen.has(id)) id = base.slice(0, 29) + "-" + i++;
    seen.add(id);
    return { id, name: n, camera: unique(), viewer: unique() };
  });
}

module.exports = { WORDS, bits, build };

if (require.main === module) {
  const names = process.argv.slice(2);
  if (!names.length) {
    console.log('Usage: node tools/make-channels.js "bob1" "bob2" "bob3"');
    process.exit(1);
  }
  const list = build(names);
  console.log("\nPaste this whole line as the value of BOB_CHANNELS in Vercel:\n");
  console.log(JSON.stringify(list));
  console.log("\nHand these out (keep this table private):\n");
  for (const c of list) console.log(c.name.padEnd(20) + "  phone: " + c.camera.padEnd(30) + "  laptop: " + c.viewer);
  console.log("\nEach passcode has about " + Math.round(bits) + " bits of randomness. The server also locks an address out after repeated wrong tries.\n");
}
