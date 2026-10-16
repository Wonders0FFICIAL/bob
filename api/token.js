const crypto = require("crypto");
const { makeEnv } = require("./_lib/env");
const { loadChannels, findChannel, norm } = require("./_lib/channels");
const { createLimiter, storeFromEnv, memoryStore } = require("./_lib/ratelimit");
const { clientIp, sameOrigin } = require("./_lib/http");

const DEFAULT_TTL = "30m";
const FAIL_DELAY_MS = 400;

function createHandler(deps = {}) {
  const getEnv = deps.getEnv || (() => makeEnv(process.env));
  const loadSdk = deps.loadSdk || (() => import("livekit-server-sdk"));
  const delay = deps.delay === undefined ? FAIL_DELAY_MS : deps.delay;
  const fallback = deps.fallbackStore || memoryStore();
  let limiter = deps.limiter || null;

  function limiterFor(env) {
    if (limiter) return limiter;
    limiter = createLimiter({
      primary: storeFromEnv(env, deps.fetch),
      fallback,
      onError: (e) => console.error("rate limit store unavailable, using memory:", e && e.message),
    });
    return limiter;
  }

  function readBody(req) {
    const b = req.body;
    if (b && typeof b === "object") return b;
    if (typeof b === "string") {
      try { return JSON.parse(b); } catch { return {}; }
    }
    return {};
  }

  function tooMany(res, seconds, text) {
    res.setHeader("Retry-After", String(seconds));
    return res.status(429).json({ error: text, retryAfter: seconds });
  }

  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Use POST." });
    }

    const env = getEnv();
    if (!sameOrigin(req, String(env("ALLOWED_ORIGINS")).split(",").map((s) => s.trim()).filter(Boolean))) {
      return res.status(403).json({ error: "Requests from other websites are not allowed." });
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
    if (missing.length) return res.status(500).json({ error: "Server is not configured yet. Missing: " + missing.join(", ") + "." });
    if (!/^wss?:\/\/[^\s/]+$/i.test(url)) {
      return res.status(500).json({ error: "LIVEKIT_URL looks wrong. It should look like wss://your-project.livekit.cloud" });
    }

    const cfg = loadChannels(env);
    if (cfg.error) return res.status(500).json({ error: cfg.error });

    const { role, code } = readBody(req);
    if (role !== "viewer" && role !== "camera") return res.status(400).json({ error: "Unknown role." });
    if (typeof code !== "string" || !norm(code)) return res.status(400).json({ error: "Enter the passcode." });
    if (code.length > 200) return res.status(400).json({ error: "That passcode is too long." });

    const lim = limiterFor(env);
    const ip = clientIp(req);

    const busy = await lim.countRequest(ip);
    if (busy.blocked) return tooMany(res, busy.retryAfter, "Too many requests. Wait a moment and try again.");
    const locked = await lim.checkBlocked(ip);
    if (locked.blocked) return tooMany(res, locked.retryAfter, "Too many wrong passcodes. Try again in " + Math.ceil(locked.retryAfter / 60) + " minutes.");

    const ch = findChannel(cfg.list, role, code);
    if (!ch) {
      await lim.recordFailure(ip);
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return res.status(401).json({ error: "Wrong passcode." });
    }

    const ttl = /^\d+[smh]$/.test(env("BOB_TOKEN_TTL")) ? env("BOB_TOKEN_TTL") : DEFAULT_TTL;
    const { AccessToken } = await loadSdk();
    const identity = role === "camera" ? "bob-camera" : "viewer-" + crypto.randomBytes(4).toString("hex");
    const at = new AccessToken(key, secret, { identity, ttl });
    at.addGrant({
      room: ch.room,
      roomJoin: true,
      canPublish: role === "camera",
      canSubscribe: true,
      canPublishData: true,
    });

    return res.status(200).json({ token: await at.toJwt(), url, identity, channel: ch.name });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
