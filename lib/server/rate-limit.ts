import "server-only";

/**
 * STEP 4A — in-memory rate limit for order submissions.
 * 5 order attempts per IP per 10 minutes. In-memory and per server instance:
 * fine for the current single-instance deployment; move to a shared store
 * (e.g. Upstash Redis) when the app scales beyond one instance.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LIMIT = 5;

/** ip -> timestamps of attempts inside the window. */
const buckets = new Map<string, number[]>();

/** True when the request may continue. Counts the attempt either way. */
export function checkOrderRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    buckets.forEach((times, key) => {
      if (times.every((t) => now - t >= WINDOW_MS)) buckets.delete(key);
    });
  }

  if (recent.length >= LIMIT) {
    buckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  buckets.set(ip, recent);
  return true;
}

/**
 * Client IP. Behind a trusted proxy (Vercel), x-forwarded-for is set by the
 * proxy. Note: when the app is exposed directly (no proxy), a client could
 * spoof this header — the deployment should always sit behind the platform
 * proxy.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
