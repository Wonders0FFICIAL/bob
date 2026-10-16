const crypto = require("crypto");

const MIN_PASSCODE = 8;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/;

const norm = (s) => String(s == null ? "" : s).trim().toUpperCase().replace(/[\s-]+/g, "");

function same(a, b) {
  const x = crypto.createHash("sha256").update(norm(a)).digest();
  const y = crypto.createHash("sha256").update(norm(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function weak(code) {
  return norm(code).length < MIN_PASSCODE;
}

function fromList(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { error: "BOB_CHANNELS is not valid JSON. Check for a missing quote or comma." }; }
  if (!Array.isArray(parsed) || !parsed.length) return { error: "BOB_CHANNELS must be a list with at least one channel." };

  const list = [];
  const ids = new Set();
  for (const c of parsed) {
    const id = String((c && c.id) || "").toLowerCase();
    if (!ID_PATTERN.test(id)) return { error: "Each channel needs an id of 1 to 32 letters, numbers or dashes." };
    if (ids.has(id)) return { error: 'Channel id "' + id + '" is used twice.' };
    ids.add(id);
    const camera = String(c.camera || c.code || "").trim();
    const viewer = String(c.viewer || c.code || "").trim();
    if (!camera || !viewer) return { error: 'Channel "' + id + '" needs a camera and a viewer passcode (or one code for both).' };
    if (weak(camera) || weak(viewer)) return { error: 'Channel "' + id + '" has a passcode shorter than ' + MIN_PASSCODE + " characters. Generate stronger ones with tools/make-channels.js." };
    list.push({ id, name: String(c.name || id).slice(0, 40), room: "ch-" + id, camera, viewer });
  }

  const seen = new Set();
  for (const c of list) {
    for (const [role, code] of [["camera", c.camera], ["viewer", c.viewer]]) {
      const key = role + ":" + norm(code);
      if (seen.has(key)) return { error: "Two channels share a " + role + " passcode. Every passcode must be unique." };
      seen.add(key);
    }
  }
  return { list };
}

function loadChannels(env) {
  const raw = env("BOB_CHANNELS");
  if (raw) return fromList(raw);

  const viewer = env("BOB_VIEWER_PASSCODE");
  const camera = env("BOB_CAMERA_PASSCODE");
  const missing = [];
  if (!viewer) missing.push("BOB_VIEWER_PASSCODE");
  if (!camera) missing.push("BOB_CAMERA_PASSCODE");
  if (missing.length) return { error: "Server is not configured yet. Missing: " + missing.join(", ") + " (or BOB_CHANNELS)." };
  return { list: [{ id: "bob", name: "Bob", room: "bob", camera, viewer }] };
}

function findChannel(list, role, code) {
  const hits = list.filter((c) => same(code, role === "camera" ? c.camera : c.viewer));
  return hits.length === 1 ? hits[0] : null;
}

module.exports = { MIN_PASSCODE, norm, same, loadChannels, findChannel };
