export const TOPIC = "bob";
export const CAMERA_ID = "bob-camera";

const enc = new TextEncoder();
const dec = new TextDecoder();

export const encode = (m) => enc.encode(JSON.stringify(m));

export function parse(payload, topic, from, wantId) {
  if (topic !== TOPIC || !from) return null;
  if (wantId && from.identity !== wantId) return null;
  let m;
  try { m = JSON.parse(dec.decode(payload)); } catch { return null; }
  return m && typeof m === "object" && typeof m.t === "string" ? m : null;
}

export function sendData(room, m, to) {
  if (!room || room.state !== "connected") return false;
  const opts = { reliable: true, topic: TOPIC };
  if (to) opts.destinationIdentities = [to];
  const p = room.localParticipant.publishData(encode(m), opts);
  if (p && p.catch) p.catch(() => {});
  return true;
}

export function why(e) {
  const m = String((e && (e.message || e.name)) || e || "unknown error").replace(/\s+/g, " ").trim();
  return m.length > 140 ? m.slice(0, 140) + "…" : m;
}

export function cameraOnline(room) {
  return !!room && [...room.remoteParticipants.values()].some((p) => p.identity === CAMERA_ID);
}

export function zoomRange(mediaTrack) {
  const c = mediaTrack && mediaTrack.getCapabilities ? mediaTrack.getCapabilities() : null;
  if (!c || !c.zoom) return null;
  return { min: c.zoom.min, max: Math.min(c.zoom.max, c.zoom.min * 6) };
}

export function zoomValue(range, percent) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
  return range.min + (range.max - range.min) * pct;
}
