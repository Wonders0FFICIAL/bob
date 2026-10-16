export async function getToken(role, code, fetchImpl = fetch) {
  let r;
  try {
    r = await fetchImpl("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, code }),
    });
  } catch {
    const e = new Error("Can't reach the server.");
    e.network = true;
    e.retryable = true;
    throw e;
  }
  let d = {};
  try { d = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(d.error || "Server error (" + r.status + ").");
    e.status = r.status;
    e.retryAfter = Number(d.retryAfter) || Number(r.headers && r.headers.get && r.headers.get("Retry-After")) || 0;
    e.retryable = r.status === 429 || r.status === 408 || (r.status >= 500 && !d.error);
    throw e;
  }
  if (!d.token || !d.url) {
    const e = new Error("The server sent an unexpected reply.");
    e.status = r.status;
    e.retryable = true;
    throw e;
  }
  return d;
}
