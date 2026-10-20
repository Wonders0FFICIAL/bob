const clamp = (value) => Math.min(1, Math.max(0, value));
const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function ramp(stops) {
  const parsed = stops.map(([at, hex]) => [at, parse(hex)]);
  return (value, alpha = 1) => {
    const v = clamp(value);
    let i = 1;
    while (i < parsed.length - 1 && v > parsed[i][0]) i++;
    const [a0, c0] = parsed[i - 1];
    const [a1, c1] = parsed[i];
    const k = a1 === a0 ? 0 : (v - a0) / (a1 - a0);
    const [r, g, b] = c0.map((n, j) => Math.round(n + (c1[j] - n) * k));
    return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  };
}

const DEFINITIONS = [
  { id: "iron", label: "Iron", stops: [[0, "#1A0A2B"], [0.3, "#5A1A8C"], [0.55, "#C4267A"], [0.75, "#FF7A1F"], [0.9, "#FFD43B"], [1, "#FFF6C8"]] },
  { id: "white", label: "White hot", stops: [[0, "#05080A"], [1, "#FFFFFF"]] },
  { id: "black", label: "Black hot", stops: [[0, "#FFFFFF"], [1, "#05080A"]] },
  { id: "rainbow", label: "Rainbow", stops: [[0, "#0B1E6B"], [0.25, "#0E7EC9"], [0.5, "#19B36B"], [0.75, "#F4D21B"], [1, "#F0541E"]] },
];

export const PALETTES = DEFINITIONS.map((d) => ({ id: d.id, label: d.label, colour: ramp(d.stops) }));
export const DEFAULT_PALETTE = "iron";

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}

export function nextPalette(id) {
  const index = PALETTES.findIndex((p) => p.id === id);
  return PALETTES[(index + 1) % PALETTES.length];
}