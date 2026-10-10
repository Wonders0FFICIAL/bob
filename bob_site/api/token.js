const crypto = require("crypto");

const ROOM = "bob";
const TTL = "6h";

const env = (k) => String(process.env[k] || "").trim().replace(/^["']+|["']+$/g, "").trim();

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

  const key = env("LIVEKIT_API_KEY");
  const secret = env("LIVEKIT_API_SECRET");
  const viewerCode = env("BOB_VIEWER_PASSCODE");
  const cameraCode = env("BOB_CAMERA_PASSCODE");
  const url = env("LIVEKIT_URL")
    .replace(/^https:\/\//i, "wss://")
    .replace(/^http:\/\//i, "ws://")
    .replace(/\/+$/, "");

  const missing = [];
  if (!url) missing.push("LIVEKIT_URL");
  if (!key) missing.push("LIVEKIT_API_KEY");
  if (!secret) missing.push("LIVEKIT_API_SECRET");
  if (!viewerCode) missing.push("BOB_VIEWER_PASSCODE");
  if (!cameraCode) missing.push("BOB_CAMERA_PASSCODE");
  if (missing.length) {
    return res.status(500).json({ error: "Server is not configured yet. Missing: " + missing.join(", ") + "." });
  }
  if (!/^wss?:\/\/[^\s/]+$/i.test(url)) {
    return res.status(500).json({ error: "LIVEKIT_URL looks wrong. It should look like wss://your-project.livekit.cloud" });
  }

  const { role, code } = readBody(req);
  if (role !== "viewer" && role !== "camera") {
    return res.status(400).json({ error: "Unknown role." });
  }
  if (typeof code !== "string" || !code) {
    return res.status(400).json({ error: "Enter the passcode." });
  }

  const expected = role === "camera" ? cameraCode : viewerCode;
  if (!same(code, expected)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong passcode." });
  }

  const { AccessToken } = await import("livekit-server-sdk");
  const identity = role === "camera" ? "bob-camera" : "viewer-" + crypto.randomBytes(4).toString("hex");
  const at = new AccessToken(key, secret, { identity, ttl: TTL });
  at.addGrant({
    room: ROOM,
    roomJoin: true,
    canPublish: role === "camera",
    canSubscribe: true,
    canPublishData: true,
  });

  return res.status(200).json({ token: await at.toJwt(), url, identity });
};