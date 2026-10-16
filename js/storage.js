const DAY = 24 * 60 * 60 * 1000;

export const MAX_AGE = {
  viewer: 14 * DAY,
  camera: 90 * DAY,
};

export function makeStorage(backend, now = Date.now) {
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

  const read = (k) => safe(() => backend.getItem(k), null);
  const write = (k, v) => safe(() => { if (v === null) backend.removeItem(k); else backend.setItem(k, v); }, undefined);

  function saveSecret(key, code) {
    write(key, JSON.stringify({ c: String(code), t: now() }));
  }

  function loadSecret(key, maxAge) {
    const raw = read(key);
    if (!raw) return null;
    let rec = null;
    try { rec = JSON.parse(raw); } catch {}
    if (!rec || typeof rec !== "object" || typeof rec.c !== "string" || !rec.c) {
      if (typeof raw === "string" && raw && !raw.startsWith("{")) {
        saveSecret(key, raw);
        return raw;
      }
      write(key, null);
      return null;
    }
    if (!Number.isFinite(rec.t) || now() - rec.t > maxAge) {
      write(key, null);
      return null;
    }
    return rec.c;
  }

  function forgetSecret(key) {
    write(key, null);
  }

  return { read, write, saveSecret, loadSecret, forgetSecret };
}

export const store = makeStorage({
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
});

export const KEYS = {
  viewer: "bob-view-code",
  camera: "bob-cam-code",
  lan: "bob-cam",
  mode: "bob-mode",
  theme: "bob-theme",
};
