const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Identify the crawler. GIN rejects the default runtime agent outright, and it
 * is the polite thing to send to every archive.
 */
const USER_AGENT = "speall-index/1.0 (+https://github.com/shubhxho/speall)";

/**
 * Public archives return the occasional gateway error under load. One 504 on
 * page 1 should not cost a whole source, so retry those with backoff.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await delay(600 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(45_000),
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
      });
      if (RETRYABLE.has(res.status) && attempt < attempts - 1) continue;
      return res;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unreachable: ${url}`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
