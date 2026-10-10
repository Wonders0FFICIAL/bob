const crypto = require("crypto");

const ROOM = "bob";
const TTL = "6h";

function same(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
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

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, BOB_VIEWER_PASSCODE, BOB_CAMERA_PASSCODE } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !BOB_VIEWER_PASSCODE || !BOB_CAMERA_PASSCODE) {
    return res.status(500).json({ error: "Server is not configured yet." });
  }

  const { role, code } = readBody(req);
  if (role !== "viewer" && role !== "camera") {
    return res.status(400).json({ error: "Unknown role." });
  }
  if (typeof code !== "string" || !code) {
    return res.status(400).json({ error: "Enter the passcode." });
  }

  const expected = role === "camera" ? BOB_CAMERA_PASSCODE : BOB_VIEWER_PASSCODE;
  if (!same(code, expected)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong passcode." });
  }

  const { AccessToken } = await import("livekit-server-sdk");
  const identity = role === "camera" ? "bob-camera" : "viewer-" + crypto.randomBytes(4).toString("hex");
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, ttl: TTL });
  at.addGrant({
    room: ROOM,
    roomJoin: true,
    canPublish: role === "camera",
    canSubscribe: true,
    canPublishData: true,
  });

  return res.status(200).json({ token: await at.toJwt(), url: LIVEKIT_URL, identity });
};
