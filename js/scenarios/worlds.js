export const W = 960;
export const H = 600;

const slab = (x, y, w, h, tone = 0) => ({ x, y, w, h, tone });

export const SCENARIOS = [
  {
    id: "earthquake",
    name: "Earthquake",
    tag: "Collapsed building",
    blurb: "A building has pancaked. People are alive in voids under the slabs, where no camera can see. Pip flies over the rubble and spots heat through the gaps. Bob squeezes in to reach them.",
    steps: ["Pip scans the collapsed zone from above", "Heat signatures appear on the map", "Bob squeezes through gaps to each one", "Pip drops a first-aid packet", "Bob comes home"],
    palette: { sky: ["#4A3427", "#1F1611"], ground: "#6B5240", speck: "rgba(235,200,160,.10)", accent: "#FFB347", slab: ["#8F9AA0", "#6B767C", "#4F5A60"], pile: ["#8A5A44", "#A8A29A", "#C97B3E", "#6E7A80"], zone: "#FFB347" },
    seed: 11,
    base: { x: 80, y: 520, a: -0.6 },
    zone: { x: 320, y: 110, w: 570, h: 370, label: "COLLAPSED ZONE" },
    blocks: [
      slab(350, 140, 200, 70, 0), slab(590, 130, 170, 60, 1), slab(790, 130, 70, 110, 2),
      slab(350, 255, 125, 115, 1), slab(515, 245, 90, 150, 2), slab(655, 245, 205, 70, 0),
      slab(655, 350, 175, 100, 1), slab(395, 430, 235, 44, 2),
    ],
    piles: [[330, 205, 22], [505, 222, 16], [632, 214, 18], [782, 292, 24], [868, 420, 24], [570, 498, 22], [326, 420, 22], [700, 112, 16], [640, 430, 18]],
    fires: [],
    survivors: [
      { x: 412, y: 233, note: "under the first slab" },
      { x: 495, y: 332, note: "in a void between two slabs" },
      { x: 634, y: 285, note: "behind a leaning slab" },
    ],
    hazards: "dust",
  },
  {
    id: "fire",
    name: "Building fire",
    tag: "Smoke-filled rooms",
    blurb: "A fire has split a floor into rooms. Smoke hides the people inside. Pip scouts over the walls and shows which rooms hold heat. Bob picks a way past the flames.",
    steps: ["Pip lifts over the walls and scans the rooms", "Heat signatures show who is inside", "Bob drives round the fire to each person", "Pip drops a first-aid packet", "Bob comes home"],
    palette: { sky: ["#2B1013", "#120708"], ground: "#3A2326", speck: "rgba(255,140,90,.08)", accent: "#FF6A3D", slab: ["#6E5A5C", "#4A3A3C", "#2E2224"], pile: ["#5A4446", "#7A5A52", "#3E2E30", "#8A4E3A"], zone: "#FF6A3D" },
    seed: 23,
    base: { x: 70, y: 450, a: 0 },
    zone: { x: 280, y: 90, w: 620, h: 420, label: "BUILDING" },
    blocks: [
      slab(280, 90, 620, 14, 2), slab(280, 496, 620, 14, 2), slab(280, 90, 14, 300, 2), slab(280, 440, 14, 70, 2), slab(886, 90, 14, 420, 2),
      slab(294, 300, 250, 12, 1), slab(610, 300, 276, 12, 1),
      slab(590, 104, 12, 130, 1), slab(590, 280, 12, 32, 1),
      slab(430, 400, 12, 96, 1), slab(430, 400, 100, 12, 1),
    ],
    piles: [[860, 330, 14]],
    fires: [{ x: 470, y: 190, r: 34 }, { x: 760, y: 440, r: 38 }, { x: 700, y: 170, r: 26 }],
    survivors: [
      { x: 350, y: 170, note: "in the north-west office" },
      { x: 520, y: 450, note: "in the store room" },
      { x: 830, y: 210, note: "near the east window" },
    ],
    hazards: "smoke",
  },
  {
    id: "tunnel",
    name: "Tunnel cave-in",
    tag: "Pip cannot follow",
    blurb: "A cave-in has sealed a tunnel except for a gap the width of a person's shoulders. Pip cannot fly through rock. Bob is the only one who can squeeze past and reach the people beyond.",
    steps: ["Pip scans the open half of the tunnel", "Bob listens for tapping and finds the gap", "Bob squeezes through the cave-in", "Bob reaches the people beyond", "Bob comes home"],
    palette: { sky: ["#10212B", "#070E13"], ground: "#33444F", speck: "rgba(140,200,230,.09)", accent: "#4FC3F7", slab: ["#6B7F8B", "#4B5C66", "#303D45"], pile: ["#5C6B74", "#7E8C94", "#8D6E5A", "#46535B"], zone: "#4FC3F7" },
    seed: 37,
    base: { x: 70, y: 300, a: 0 },
    zone: { x: 110, y: 235, w: 440, h: 130, label: "OPEN TUNNEL" },
    flyMaxX: 560,
    explore: { x: 110, y: 250, w: 790, h: 100 },
    tapping: true,
    blocks: [slab(0, 150, 960, 86, 2), slab(0, 364, 960, 86, 2), slab(560, 236, 54, 56, 1), slab(560, 316, 54, 48, 1)],
    piles: [[540, 262, 20], [585, 232, 22], [588, 350, 22], [622, 262, 14], [552, 346, 18]],
    fires: [],
    survivors: [
      { x: 720, y: 290, note: "beyond the cave-in" },
      { x: 830, y: 330, note: "deeper in the tunnel" },
    ],
    hazards: "dust",
  },
];

export const byId = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
