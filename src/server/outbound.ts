import "server-only";

// One limiter for every outbound call (bank and Huawei share 60 requests a minute).
// We keep a margin below the platform limit. Callers wait for a slot instead of failing.
const limitPerMinute = 55;
const sent: number[] = [];
let queue: Promise<void> = Promise.resolve();

export function acquireSlot(): Promise<void> {
  const next = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (sent.length && now - sent[0]! >= 60_000) sent.shift();
      if (sent.length < limitPerMinute) {
        sent.push(now);
        return;
      }
      await new Promise((r) => setTimeout(r, 60_000 - (now - sent[0]!) + 5));
    }
  });
  queue = next.catch(() => undefined);
  return next;
}

/** For tests and the admin health line. */
export function slotsUsedLastMinute(): number {
  const now = Date.now();
  return sent.filter((t) => now - t < 60_000).length;
}
