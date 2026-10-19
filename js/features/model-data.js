export const ROLES = ["shell", "plate", "frame", "hangar", "wheel", "steel", "accent", "tape", "lettering", "dark", "glass", "screen", "headlight", "taillight", "beacon", "battery", "pcb", "packet1", "packet2", "packet3"];

export function roleOf(name) {
  const label = name.replace(/^Pip /, "");
  if (/^Reflective tape/.test(label)) return "tape";
  if (/^BOB lettering/.test(label)) return "lettering";
  if (/^Outer shell/.test(label)) return "shell";
  if (/^(Fender|Hangar door|Eye ring|Payload trapdoor|Duct)/.test(label)) return "accent";
  if (/^(Lower plate|Upper plate)/.test(label)) return "plate";
  if (/^(Electronics bay|Payload compartment|Frame|Standoff|Arm |Dispenser guard)/.test(label)) return "frame";
  if (/^Drone hangar/.test(label)) return "hangar";
  if (/^Tyre/.test(label)) return "wheel";
  if (/^(Hub|Axle|Shock|Payload chute|Motor (front|rear)|Dispenser drum|Servo shaft)/.test(label)) return "steel";
  if (/^(Eye window|Camera lens)/.test(label)) return "glass";
  if (/^LCD screen/.test(label)) return "screen";
  if (/^(Headlight|Front light|Belly light)/.test(label)) return "headlight";
  if (/^(Tail light|Rear light)/.test(label)) return "taillight";
  if (/^(Roof beacon|Beacon)/.test(label)) return "beacon";
  if (/^LiPo/.test(label)) return "battery";
  if (/^(Flight controller|Arduino|3A regulator)/.test(label)) return "pcb";
  if (/^Packet 1/.test(label)) return "packet1";
  if (/^Packet 2/.test(label)) return "packet2";
  if (/^Packet 3/.test(label)) return "packet3";
  if (/^(ESP32-CAM|LCD 16x2|ESC |Motor mount|Propeller|Camera module|Thermal|Antenna|Dispenser servo)/.test(label)) return "dark";
  return null;
}

export const GROUPS = [
  {
    id: "shell",
    view: { azimuth: 2.36, polar: 1.2 },
    title: "Protective shell",
    text: "One cover over the whole robot keeps dust, debris and splashes off the electronics. Orange fenders guard the wheels and the BOB name is on both sides. Plan: print it in a heat-tolerant plastic such as PETG or ASA. Try Hide shell to see inside.",
    match: /^(Outer shell|Fender|BOB lettering)/,
  },
  {
    id: "eye",
    view: { azimuth: 1.35, polar: 1.3 },
    title: "Camera eye",
    text: "Design plan: an ESP32-CAM sits behind a window at the front in place of the phone. The shell has a round hole for the lens, with an orange ring around it. Today's demo still streams from a phone.",
    match: /^(ESP32-CAM|Eye)/,
  },
  {
    id: "lights",
    view: { azimuth: 1.1, polar: 1.25 },
    title: "Lights and display",
    text: "Design plan: headlights for dark rooms, tail lights and a roof beacon so rescuers can spot Bob, and a 16x2 LCD behind a window on the sloped front for battery and signal status. All of it shows through openings in the shell.",
    match: /^(Headlight|Tail light|Roof beacon|LCD)/,
  },
  {
    id: "chassis",
    view: { azimuth: 2.3, polar: 0.95 },
    title: "Chassis and electronics",
    text: "Two layers with the battery, speed controllers, Arduino and a separate 3A regulator for the camera and servos sandwiched in between. The parts shown here are stand-ins until the real ones arrive.",
    match: /^(Lower plate|Upper plate|Electronics bay|LiPo|Arduino|ESC |3A regulator)/,
  },
  {
    id: "suspension",
    view: { azimuth: 2.9, polar: 1.35 },
    title: "Suspension",
    text: "Solid axles with 55 mm oil-filled shock absorbers give Bob ground clearance and travel over rubble and uneven floors.",
    match: /^(Axle|Shock)/,
  },
  {
    id: "wheels",
    view: { azimuth: 2.2, polar: 1.3 },
    title: "Wheels and drive",
    text: "Four-wheel drive with high-torque gear motors, so Bob keeps moving when one wheel loses grip.",
    match: /^(Tyre|Hub)/,
  },
  {
    id: "hangar",
    view: { azimuth: 0.9, polar: 0.85 },
    title: "Drone hangar",
    text: "Design plan: Pip, a micro-drone, launches from the roof to scout over obstacles and high spots. The clamshell doors open on servos. Use Launch Pip to watch it lift off, or View Pip to look at it on its own.",
    match: /^(Drone hangar|Hangar door|Pip )/,
  },
  {
    id: "payload",
    view: { azimuth: -1.2, polar: 1.0 },
    title: "Payload bay",
    text: "Design plan: a servo-driven trapdoor drops first-aid items, a radio or medicine to a trapped person.",
    match: /^Payload/,
  },
  {
    id: "tape",
    view: { azimuth: 3.9, polar: 1.3 },
    title: "Reflective tape",
    text: "Retroreflective tape bounces a flashlight beam straight back, so rescuers can spot Bob in smoke or darkness. Try Lights off to see the idea.",
    match: /^Reflective tape/,
  },
];

export const PIP_GROUPS = [
  {
    id: "pip-cameras",
    title: "Cameras",
    view: { azimuth: 1.4, polar: 1.3 },
    text: "Design plan: a main camera and a thermal camera share a small pod at the front, tilted up 10 degrees. The thermal one shows heat from people and fire through smoke.",
    match: /^(Camera|Thermal)/,
  },
  {
    id: "pip-lights",
    title: "Lights",
    view: { azimuth: 0.9, polar: 1.2 },
    text: "Design plan: two white front lights, a belly light to help it land, red rear lights and an amber beacon on top so Bob and the crew can see where it is.",
    match: /^(Front light|Belly light|Rear light|Beacon)/,
  },
  {
    id: "pip-dispenser",
    title: "Packet dispenser",
    view: { azimuth: 2.4, polar: 1.45 },
    text: "Design plan: a rotating drum under the body holds three small packets and drops them one at a time, for example a first-aid tablet, a glow stick or a tracking tag. Pip is too small to carry water or put out a fire.",
    match: /^(Dispenser|Packet|Servo)/,
  },
  {
    id: "pip-rings",
    title: "Rings and motors",
    view: { azimuth: 2.2, polar: 1.1 },
    text: "Each propeller spins inside its own ring, so a bump against a wall or a person does not break it. Four small brushless motors lift Pip. Try Spin props.",
    match: /^(Duct|Propeller|Motor)/,
  },
  {
    id: "pip-frame",
    title: "Frame and electronics",
    view: { azimuth: 2.6, polar: 0.95 },
    text: "Two plates hold the battery, the flight controller and the antenna. The parts shown are stand-ins until the real ones are chosen.",
    match: /^(Frame|Standoff|Arm|LiPo|Flight|Antenna)/,
  },
];

export function namesIn(group, allNames) {
  return allNames.filter((n) => group.match.test(n));
}

const SHARED = {
  battery: { color: "#3B6FD4", roughness: 0.5, metalness: 0 },
  pcb: { color: "#1C6B45", roughness: 0.5, metalness: 0 },
  packet1: { color: "#E5322D", roughness: 0.5, metalness: 0 },
  packet2: { color: "#F4C20D", roughness: 0.5, metalness: 0 },
  packet3: { color: "#2FB36B", roughness: 0.5, metalness: 0 },
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
