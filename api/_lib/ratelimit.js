function memoryStore(now = Date.now) {
  const map = new Map();

  function prune() {
    if (map.size < 5000) return;
    const t = now();
    for (const [k, v] of map) if (v.exp <= t) map.delete(k);
  }

  function live(key) {
    const v = map.get(key);
    if (!v) return null;
    if (v.exp <= now()) { map.delete(key); return null; }
    return v;
  }

  return {
    kind: "memory",
    async get(key) {
      const v = live(key);
      return v ? { count: v.count, ttl: Math.max(1, Math.ceil((v.exp - now()) / 1000)) } : { count: 0, ttl: 0 };
    },
    async incr(key, windowSec) {
      prune();
      let v = live(key);
      if (!v) { v = { count: 0, exp: now() + windowSec * 1000 }; map.set(key, v); }
      v.count += 1;
      return { count: v.count, ttl: Math.max(1, Math.ceil((v.exp - now()) / 1000)) };
    },
    clear() { map.clear(); },
  };
}

function redisStore(url, token, fetchImpl = fetch) {
  const base = url.replace(/\/+$/, "");

  async function run(commands) {
    const r = await fetchImpl(base + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!r.ok) throw new Error("rate limit store error " + r.status);
    const out = await r.json();
    return out.map((x) => {
      if (x && x.error) throw new Error("rate limit store: " + x.error);
      return x && x.result;
    });
  }

  return {
    kind: "redis",
    async get(key) {
      const [count, ttl] = await run([["GET", key], ["TTL", key]]);
      return { count: Number(count) || 0, ttl: Math.max(0, Number(ttl) || 0) };
    },
    async incr(key, windowSec) {
      const r = await run([["SET", key, "0", "EX", String(windowSec), "NX"], ["INCR", key], ["TTL", key]]);
      return { count: Number(r[1]) || 0, ttl: Math.max(1, Number(r[2]) || windowSec) };
    },
  };
}

function storeFromEnv(env, fetchImpl) {
  const url = env("UPSTASH_REDIS_REST_URL") || env("KV_REST_API_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN") || env("KV_REST_API_TOKEN");
  if (url && token) return redisStore(url, token, fetchImpl);
  return null;
}

const DEFAULTS = {
  failLimit: 8,
  failWindow: 15 * 60,
  requestLimit: 60,
  requestWindow: 60,
};

function createLimiter({ primary, fallback, options = {}, onError = () => {} } = {}) {
  const o = { ...DEFAULTS, ...options };
  const backup = fallback || memoryStore();

  async function use(fn) {
    if (primary) {
      try { return await fn(primary); } catch (e) { onError(e); }
    }
    return fn(backup);
  }

  return {
    options: o,
    async checkBlocked(ip) {
      const f = await use((s) => s.get("bob:fail:" + ip));
      if (f.count >= o.failLimit) return { blocked: true, retryAfter: f.ttl || o.failWindow, why: "fail" };
      return { blocked: false };
    },
    async countRequest(ip) {
      const r = await use((s) => s.incr("bob:req:" + ip, o.requestWindow));
      if (r.count > o.requestLimit) return { blocked: true, retryAfter: r.ttl, why: "rate" };
      return { blocked: false };
    },
    async recordFailure(ip) {
      return use((s) => s.incr("bob:fail:" + ip, o.failWindow));
    },
    async backend() {
      return primary ? primary.kind : backup.kind;
    },
  };
}

module.exports = { memoryStore, redisStore, storeFromEnv, createLimiter, DEFAULTS };
