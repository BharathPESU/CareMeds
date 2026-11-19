export const DEFAULT_LOCKOUT_THRESHOLD = 5;
export const IP_RATE_LIMIT_MAX_ATTEMPTS = 20;
export const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface IpWindowEntry {
  timestamps: number[];
}

const ipAttemptWindows = new Map<string, IpWindowEntry>();

export function checkIpRateLimit(
  ipAddress: string,
  now = Date.now(),
  maxAttempts = IP_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs = IP_RATE_LIMIT_WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const entry = ipAttemptWindows.get(ipAddress) ?? { timestamps: [] };
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= maxAttempts) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    ipAttemptWindows.set(ipAddress, entry);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  ipAttemptWindows.set(ipAddress, entry);
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetIpRateLimitForTests(ipAddress?: string): void {
  if (ipAddress) {
    ipAttemptWindows.delete(ipAddress);
  } else {
    ipAttemptWindows.clear();
  }
}

export function evaluateFailedAttempt(
  currentFailedCount: number,
  lockoutThreshold = DEFAULT_LOCKOUT_THRESHOLD
): { nextFailedCount: number; shouldLock: boolean } {
  const nextFailedCount = currentFailedCount + 1;
  return {
    nextFailedCount,
    shouldLock: nextFailedCount >= lockoutThreshold,
  };
}
