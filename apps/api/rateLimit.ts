interface Bucket {
  starts: number[];
}

const buckets = new Map<string, Bucket>();

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { starts: [] };
  bucket.starts = bucket.starts.filter((timestamp) => now - timestamp < windowMs);
  if (bucket.starts.length >= limit) {
    throw new Error("Rate limit exceeded. Wait briefly and try again.");
  }
  bucket.starts.push(now);
  buckets.set(key, bucket);
}

export function clearRateLimitsForTests(): void {
  buckets.clear();
}
