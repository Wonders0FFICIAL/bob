function header(req, name) {
  const h = req.headers || {};
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
}

function clientIp(req) {
  const direct = header(req, "x-vercel-forwarded-for") || header(req, "x-real-ip");
  if (direct) return String(direct).split(",")[0].trim();
  const fwd = header(req, "x-forwarded-for");
  if (fwd) return String(fwd).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function sameOrigin(req, extraAllowed = []) {
  const origin = header(req, "origin");
  if (!origin) return true;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  const own = header(req, "x-forwarded-host") || header(req, "host");
  if (own && host === String(own).split(",")[0].trim()) return true;
  return extraAllowed.some((a) => {
    try { return new URL(a).host === host; } catch { return false; }
  });
}

module.exports = { header, clientIp, sameOrigin };
