// Rate-limit awareness for the analysis pipeline. When a burst of work runs
// at once (e.g. a Gmail sync queues 25 messages and every message's analysis
// starts together), entity calls and integrations can transiently return
// "Rate limit exceeded" / 429. Callers wrap individual calls with withBackoff,
// which retries ONLY genuine rate-limit errors, with exponential backoff and
// jitter — never a tight retry loop.

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(e) {
  const msg = String((e && e.message) || e || "");
  return /rate.?limit|too many requests|\b429\b/i.test(msg);
}

// Retries only rate-limit errors. First delay delayMs, doubling each retry,
// with jitter so concurrent runs don't retry in lockstep.
export async function withBackoff(fn, { retries = 4, delayMs = 1200 } = {}) {
  let delay = delayMs;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isRateLimitError(e)) throw e;
      await sleep(delay + Math.floor(Math.random() * 600));
      delay = delay * 2;
    }
  }
}