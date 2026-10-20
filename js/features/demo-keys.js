const DRIVE_KEYS = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  KeyW: "ArrowUp",
  KeyS: "ArrowDown",
  KeyA: "ArrowLeft",
  KeyD: "ArrowRight",
};

const ACTIONS = {
  "1": "fire",
  "2": "survivor",
  "3": "base",
  "4": "pip",
  "5": "piphold",
  p: "piphold",
  "0": "stop",
  " ": "stop",
  r: "reset",
  v: "cycleview",
  m: "viewmap",
  b: "viewbob",
  t: "viewpip",
  i: "inset",
  x: "swap",
  c: "palette",
  "+": "zoomin",
  "=": "zoomin",
  "-": "zoomout",
  _: "zoomout",
  f: "full",
  h: "help",
  "?": "help",
  Escape: "closehelp",
};

export const HELP = [
  ["W A S D  or  arrows", "Drive Bob"],
  ["Shift", "Sprint"],
  ["1  2  3", "Fire, survivor, base"],
  ["4", "Launch or recall Pip"],
  ["P  or  5", "Keep Pip out"],
  ["0  or  Space", "Stop"],
  ["V", "Next view"],
  ["M  B  T", "Map, Bob, Pip thermal"],
  ["I  X", "Inset on or off, swap"],
  ["C  + \u2212", "Thermal palette, zoom"],
  ["F", "Full screen"],
  ["R", "Reset"],
  ["H  or  ?", "This list"],
];

export function driveKeyFor(code) {
  return DRIVE_KEYS[code] || null;
}

export function actionFor(key) {
  const name = key.length === 1 ? key.toLowerCase() : key;
  return Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null;
}

export const ACTION_NAMES = [...new Set(Object.values(ACTIONS))];