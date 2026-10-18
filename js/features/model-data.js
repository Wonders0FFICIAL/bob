export const ROLES = ["shell", "plate", "hangar", "wheel", "steel", "accent", "tape", "lettering", "dark", "light"];

export function roleOf(label) {
  if (/^Reflective tape/.test(label)) return "tape";
  if (/^BOB lettering/.test(label)) return "lettering";
  if (/^(Electronics bay|Payload compartment|Hangar door)/.test(label)) return "shell";
  if (/^(Lower plate|Upper plate|Sloped front plate)/.test(label)) return "plate";
  if (/^Drone hangar/.test(label)) return "hangar";
  if (/^Tyre/.test(label)) return "wheel";
  if (/^(Hub|Axle|Shock|Mast|Phone clamp spine)/.test(label)) return "steel";
  if (/^(Tilt servo|Phone$)/.test(label)) return "dark";
  if (/^(Camera lens|Tow loop)/.test(label)) return "accent";
  if (/^(LED bar|LCD)/.test(label)) return "light";
  return null;
}

export const GROUPS = [
  {
    id: "chassis",
    title: "Chassis and electronics",
    text: "Two layers with the battery, speed controllers, Arduino and a separate 3A regulator for the camera and servos sandwiched in between. A sloped front plate helps Bob ride up over small obstacles.",
    match: /^(Lower plate|Upper plate|Electronics bay|Sloped front plate|LCD|BOB lettering)/,
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
    id: "camera",
    title: "Camera mast",
    text: "A phone rides on a tilt servo at the front. It streams video to the control room page over HTTPS and has an LED bar for dark rooms.",
    match: /^(Mast|Tilt servo|Phone|Camera lens|LED bar)/,
  },
  {
    id: "hangar",
    title: "Drone hangar",
    text: "Design plan: a micro-drone launches from the roof to scout over obstacles and high spots. The clamshell doors open on servos.",
    match: /^(Drone hangar|Hangar door)/,
  },
  {
    id: "payload",
    title: "Payload bay",
    text: "Design plan: a servo-driven trapdoor drops first-aid items, a radio or medicine to a trapped person, with a light inside.",
    match: /^Payload compartment/,
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
  light: { color: "#E9EEF1", roughness: 0.5, metalness: 0 },
};

function scheme(id, label, note, roles) {
  return { id, label, note, roles: { ...SHARED, ...roles } };
}

export const SCHEMES = [
  scheme("orange", "Safety orange", "Stands out in poor light and on camera.", {
    shell: { color: "#FF5A14", roughness: 0.55, metalness: 0 },
    plate: { color: "#10181D", roughness: 0.7, metalness: 0 },
    hangar: { color: "#33495A", roughness: 0.6, metalness: 0 },
    wheel: { color: "#0C1115", roughness: 0.9, metalness: 0 },
    steel: { color: "#5E7080", roughness: 0.45, metalness: 0.25 },
    accent: { color: "#FFD21F", roughness: 0.4, metalness: 0 },
  }),
  scheme("charcoal", "Charcoal and tape", "Hides soot. Reflective tape does the visibility work.", {
    shell: { color: "#30363B", roughness: 0.6, metalness: 0 },
    plate: { color: "#171B1F", roughness: 0.7, metalness: 0 },
    hangar: { color: "#3E464D", roughness: 0.6, metalness: 0 },
    wheel: { color: "#0C1013", roughness: 0.9, metalness: 0 },
    steel: { color: "#6B7782", roughness: 0.45, metalness: 0.25 },
    accent: { color: "#FF6A00", roughness: 0.4, metalness: 0 },
  }),
  scheme("hybrid", "Charcoal and orange", "Dark body, bright roof parts, reflective tape.", {
    shell: { color: "#FF5A14", roughness: 0.55, metalness: 0 },
    plate: { color: "#171B1F", roughness: 0.7, metalness: 0 },
    hangar: { color: "#3E464D", roughness: 0.6, metalness: 0 },
    wheel: { color: "#0C1013", roughness: 0.9, metalness: 0 },
    steel: { color: "#6B7782", roughness: 0.45, metalness: 0.25 },
    accent: { color: "#FFD21F", roughness: 0.4, metalness: 0 },
    bay: { color: "#30363B", roughness: 0.6, metalness: 0 },
  }),
  scheme("red", "Rescue red", "Classic emergency colour.", {
    shell: { color: "#B3191F", roughness: 0.55, metalness: 0 },
    plate: { color: "#10181D", roughness: 0.7, metalness: 0 },
    hangar: { color: "#33495A", roughness: 0.6, metalness: 0 },
    wheel: { color: "#0C1115", roughness: 0.9, metalness: 0 },
    steel: { color: "#5E7080", roughness: 0.45, metalness: 0.25 },
    accent: { color: "#FFD21F", roughness: 0.4, metalness: 0 },
  }),
];

export function materialFor(schemeDef, label) {
  const role = roleOf(label);
  if (!role) return null;
  if (schemeDef.roles.bay && label === "Electronics bay") return schemeDef.roles.bay;
  return schemeDef.roles[role];
}

export const DEFAULT_SCHEME = "orange";
