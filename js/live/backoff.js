export const BASE_MS = 3000;
export const MAX_MS = 30000;
export const STABLE_MS = 30000;

export function nextDelay(attempt, random = Math.random, base = BASE_MS, max = MAX_MS) {
  const raw = Math.min(max, base * 2 ** Math.max(0, attempt));
  return Math.round(raw * (0.75 + 0.5 * random()));
}

export function retryDelay(attempt, retryAfterSeconds, random) {
  const floor = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 0;
  return Math.max(floor, nextDelay(attempt, random));
}
