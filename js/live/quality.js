export const LEVELS = ["low", "standard", "high"];
export const DEFAULT_LEVEL = "standard";

export const LABELS = {
  low: "Low",
  standard: "Standard",
  high: "High",
};

const PRESET_NAME = { low: "h360", standard: "h720", high: "h1080" };

export function isLevel(x) {
  return LEVELS.includes(x);
}

export function levelOf(x) {
  return isLevel(x) ? x : DEFAULT_LEVEL;
}

export function nextLevel(level) {
  return LEVELS[(LEVELS.indexOf(levelOf(level)) + 1) % LEVELS.length];
}

export function settingsFor(LK, level) {
  const presets = (LK && LK.VideoPresets) || {};
  const p = presets[PRESET_NAME[levelOf(level)]] || presets.h720;
  if (!p) return { capture: {}, publish: {} };
  return {
    capture: { resolution: p.resolution },
    publish: p.encoding ? { videoEncoding: p.encoding } : {},
  };
}
