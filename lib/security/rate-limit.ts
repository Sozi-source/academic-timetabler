interface AttemptRecord {
  count: number;
  resetAt: number;
}

const attemptsMap = new Map<string, AttemptRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptsMap.entries()) {
    if (record.resetAt <= now) {
      attemptsMap.delete(key);
    }
  }
}, 60_000).unref?.();

/**
 * Checks and records a rate limit attempt for a given identifier.
 * @param key Unique key (e.g. `student-login:${admissionNumber}`)
 * @param maxAttempts Maximum permitted attempts within the window
 * @param windowMs Window duration in milliseconds (e.g. 15 minutes)
 * @returns { success: boolean; remaining: number; retryAfterSec?: number }
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
): { success: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const record = attemptsMap.get(key);

  if (!record || record.resetAt <= now) {
    attemptsMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: maxAttempts - record.count,
  };
}

/**
 * Resets the rate limiter for a specific key upon successful login.
 */
export function clearRateLimit(key: string): void {
  attemptsMap.delete(key);
}
