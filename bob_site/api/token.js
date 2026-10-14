const crypto = require("crypto");

const TTL = "6h";

const env = (k) => String(process.env[k] || "").trim().replace(/^["']+|["']+$/g, "").trim();
const norm = (s) => String(s || "").trim().toUpperCase().replace(/[\s-]+/g, "");

function same(a, b) {
  const x = crypto.createHash("sha256").update(norm(a)).digest();
  const y = crypto.createHash("sha256").update(norm(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}

function loadChannels() {
  const raw = env("BOB_CHANNELS");

  if (!raw) {
    const viewer = env("BOB_VIEWER_PASSCODE");
    const camera = env("BOB_CAMERA_PASSCODE");
    const missing = [];
    if (!viewer) missing.push("BOB_VIEWER_PASSCODE");
    if (!camera) missing.push("BOB_CAMERA_PASSCODE");
    if (missing.length) return { error: "Server is not configured yet. Missing: " + missing.join(", ") + " (or BOB_CHANNELS)." };
    return { list: [{ id: "bob", name: "Bob", room: "bob", camera, viewer }] };
  }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { error: "BOB_CHANNELS is not valid JSON. Check for a missing quote or comma." }; }
  if (!Array.isArray(parsed) || !parsed.length) return { error: "BOB_CHANNELS must be a list with at least one channel." };

  const list = [];
  const seen = new Set();
  for (const c of parsed) {
    const id = String((c && c.id) || "").toLowerCase();
    if (!/^[a-z0-9-]{1,32}$/.test(id)) return { error: "Each channel needs an id of 1 to 32 letters, numbers or dashes." };
    if (seen.has(id)) return { error: 'Channel id "' + id + '" is used twice.' };
    seen.add(id);
    const camera = String(c.camera || c.code || "").trim();
    const viewer = String(c.viewer || c.code || "").trim();
    if (!camera || !viewer) return { error: 'Channel "' + id + '" needs a camera and a viewer passcode (or one code for both).' };
    list.push({ id, name: String(c.name || id).slice(0, 40), room: "ch-" + id, camera, viewer });
  }
  return { list };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const key = env("LIVEKIT_API_KEY");
  const secret = env("LIVEKIT_API_SECRET");
  const url = env("LIVEKIT_URL")
    .replace(/^https:\/\//i, "wss://")
    .replace(/^http:\/\//i, "ws://")
    .replace(/\/+$/, "");

  const missing = [];
  if (!url) missing.push("LIVEKIT_URL");
  if (!key) missing.push("LIVEKIT_API_KEY");
  if (!secret) missing.push("LIVEKIT_API_SECRET");
  if (missing.length) {
    return res.status(500).json({ error: "Server is not configured yet. Missing: " + missing.join(", ") + "." });
  }
  if (!/^wss?:\/\/[^\s/]+$/i.test(url)) {
    return res.status(500).json({ error: "LIVEKIT_URL looks wrong. It should look like wss://your-project.livekit.cloud" });
  }

  const cfg = loadChannels();
  if (cfg.error) return res.status(500).json({ error: cfg.error });

  const { role, code } = readBody(req);
  if (role !== "viewer" && role !== "camera") {
    return res.status(400).json({ error: "Unknown role." });
  }
  if (typeof code !== "string" || !norm(code)) {
    return res.status(400).json({ error: "Enter the passcode." });
  }

  const hits = cfg.list.filter((c) => same(code, role === "camera" ? c.camera : c.viewer));
  if (!hits.length) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong passcode." });
  }
  if (hits.length > 1) {
    return res.status(500).json({ error: "Two channels share this passcode. Every passcode must be unique." });
  }
  const ch = hits[0];

  const { AccessToken } = await import("livekit-server-sdk");
  const identity = role === "camera" ? "bob-camera" : "viewer-" + crypto.randomBytes(4).toString("hex");
  const at = new AccessToken(key, secret, { identity, ttl: TTL });
  at.addGrant({
    room: ch.room,
    roomJoin: true,
    canPublish: role === "camera",
    canSubscribe: true,
    canPublishData: true,
  });

  return res.status(200).json({ token: await at.toJwt(), url, identity, channel: ch.name });
};