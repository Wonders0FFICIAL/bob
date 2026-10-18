export const ROLES = ["shell", "plate", "frame", "hangar", "wheel", "steel", "accent", "tape", "lettering", "dark", "glass", "screen", "headlight", "taillight", "beacon"];

export function roleOf(label) {
  if (/^Reflective tape/.test(label)) return "tape";
  if (/^BOB lettering/.test(label)) return "lettering";
  if (/^Outer shell/.test(label)) return "shell";
  if (/^(Fender|Hangar door|Eye ring|Payload trapdoor)/.test(label)) return "accent";
  if (/^(Lower plate|Upper plate)/.test(label)) return "plate";
  if (/^(Electronics bay|Payload compartment)/.test(label)) return "frame";
  if (/^Drone hangar/.test(label)) return "hangar";
  if (/^Tyre/.test(label)) return "wheel";
  if (/^(Hub|Axle|Shock|Payload chute)/.test(label)) return "steel";
  if (/^(Eye window)/.test(label)) return "glass";
  if (/^LCD screen/.test(label)) return "screen";
  if (/^Headlight/.test(label)) return "headlight";
  if (/^Tail light/.test(label)) return "taillight";
  if (/^Roof beacon/.test(label)) return "beacon";
  if (/^(ESP32-CAM|LCD 16x2|Micro drone|Drone |LiPo|Arduino|ESC |3A regulator)/.test(label)) return "dark";
  return null;
}

export const GROUPS = [
  {
    id: "shell",
    title: "Protective shell",
    text: "One cover over the whole robot keeps dust, debris and splashes off the electronics. Orange fenders guard the wheels and the BOB name is on both sides. Plan: print it in a heat-tolerant plastic such as PETG or ASA. Try Hide shell to see inside.",
    match: /^(Outer shell|Fender|BOB lettering)/,
  },
  {
    id: "eye",
    title: "Camera eye",
    text: "Design plan: an ESP32-CAM sits behind a window at the front in place of the phone. The shell has a round hole for the lens, with an orange ring around it. Today's demo still streams from a phone.",
    match: /^(ESP32-CAM|Eye)/,
  },
  {
    id: "lights",
    title: "Lights and display",
    text: "Design plan: headlights for dark rooms, tail lights and a roof beacon so rescuers can spot Bob, and a 16x2 LCD behind a window on the sloped front for battery and signal status. All of it shows through openings in the shell.",
    match: /^(Headlight|Tail light|Roof beacon|LCD)/,
  },
  {
    id: "chassis",
    title: "Chassis and electronics",
    text: "Two layers with the battery, speed controllers, Arduino and a separate 3A regulator for the camera and servos sandwiched in between. The parts shown here are stand-ins until the real ones arrive.",
    match: /^(Lower plate|Upper plate|Electronics bay|LiPo|Arduino|ESC |3A regulator)/,
  },
  {
    id: "suspension",
    title: "Suspension",
    text: "Solid axles with 55 mm oil-filled shock absorbers give Bob ground clearance and travel over rubble and uneven floors.",
    match: /^(Axle|Shock)/,
  },
  {
    id: "wheels",
    title: "Wheels and drive",
    text: "Four-wheel drive with high-torque gear motors, so Bob keeps moving when one wheel loses grip.",
    match: /^(Tyre|Hub)/,
  },
  {
    id: "hangar",
    title: "Drone hangar",
    text: "Design plan: a micro-drone launches from the roof to scout over obstacles and high spots. The clamshell doors open on servos.",
    match: /^(Drone hangar|Hangar door|Micro drone|Drone )/,
  },
  {
    id: "payload",
    title: "Payload bay",
    text: "Design plan: a servo-driven trapdoor drops first-aid items, a radio or medicine to a trapped person.",
    match: /^Payload/,
  },
  {
    id: "tape",
    title: "Reflective tape",
    text: "Retroreflective tape bounces a flashlight beam straight back, so rescuers can spot Bob in smoke or darkness. Try Lights off to see the idea.",
    match: /^Reflective tape/,
  },
];

export function namesIn(group, allNames) {
  return allNames.filter((n) => group.match.test(n));
}

const SHARED = {
  tape: { color: "#F4F7F8", roughness: 0.35, metalness: 0, emissive: "#FFFFFF", emissiveIntensity: 0.12 },
  lettering: { color: "#F3F6F8", roughness: 0.5, metalness: 0 },
  dark: { color: "#0D1418", roughness: 0.6, metalness: 0 },
  glass: { color: "#0A1014", roughness: 0.15, metalness: 0.3 },
  screen: { color: "#7FD36B", roughness: 0.4, metalness: 0, emissive: "#3FAE4A", emissiveIntensity: 0.35 },
  headlight: { color: "#FFF8E6", roughness: 0.3, metalness: 0, emissive: "#FFF3C4", emissiveIntensity: 0.5 },
  taillight: { color: "#C4161C", roughness: 0.3, metalness: 0, emissive: "#FF2A2A", emissiveIntensity: 0.35 },
  beacon: { color: "#FFB000", roughness: 0.3, metalness: 0, emissive: "#FF9A00", emissiveIntensity: 0.4 },
};

function scheme(id, label, note, roles) {
  return { id, label, note, roles: { ...SHARED, ...roles } };
}

const COMMON = {
  plate: { color: "#171B1F", roughness: 0.7, metalness: 0 },
  frame: { color: "#3A4147", roughness: 0.6, metalness: 0 },
  hangar: { color: "#3E464D", roughness: 0.6, metalness: 0 },
  wheel: { color: "#0C1013", roughness: 0.9, metalness: 0 },
  steel: { color: "#6B7782", roughness: 0.45, metalness: 0.25 },
};

export const SCHEMES = [
  scheme("hybrid", "Charcoal and orange", "Dark shell hides soot, orange fenders and doors stand out, tape adds more.", {
    ...COMMON,
    shell: { color: "#30363B", roughness: 0.6, metalness: 0 },
    accent: { color: "#FF5A14", roughness: 0.5, metalness: 0 },
  }),
  scheme("orange", "Safety orange", "Stands out in poor light and on camera.", {
    ...COMMON,
    shell: { color: "#FF5A14", roughness: 0.55, metalness: 0 },
    accent: { color: "#1B2328", roughness: 0.6, metalness: 0 },
  }),
  scheme("charcoal", "Charcoal and tape", "All dark. Reflective tape does the visibility work.", {
    ...COMMON,
    shell: { color: "#30363B", roughness: 0.6, metalness: 0 },
    accent: { color: "#59636B", roughness: 0.6, metalness: 0 },
  }),
  scheme("red", "Rescue red", "Classic emergency colour.", {
    ...COMMON,
    shell: { color: "#B3191F", roughness: 0.55, metalness: 0 },
    accent: { color: "#1B2328", roughness: 0.6, metalness: 0 },
  }),
];

export function materialFor(schemeDef, label) {
  const role = roleOf(label);
  if (!role) return null;
  return schemeDef.roles[role];
}

export const DEFAULT_SCHEME = "hybrid";
