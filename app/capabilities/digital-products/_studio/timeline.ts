/**
 * The session clock. Every wait and tween runs on requestAnimationFrame against "active"
 * time: it stops while paused (off-screen, hidden tab, or the pause button), finishes at
 * once when skipping, and rejects with `Cancelled` when the session is replayed.
 */

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

export class Timeline {
  private paused = false;
  private skipping = false;
  private killed = false;
  /** active (unpaused) milliseconds since the session started */
  elapsed = 0;
  private lastTick: number | null = null;
  private clockRaf = 0;

  constructor() {
    const tick = (now: number) => {
      if (this.killed) return;
      if (this.lastTick !== null && !this.paused && !this.skipping) {
        this.elapsed += Math.min(100, now - this.lastTick);
      }
      this.lastTick = now;
      this.clockRaf = requestAnimationFrame(tick);
    };
    this.clockRaf = requestAnimationFrame(tick);
  }

  get isPaused() {
    return this.paused;
  }

  get isSkipping() {
    return this.skipping;
  }

  get isKilled() {
    return this.killed;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  /** Everything still to come completes immediately. */
  skip() {
    this.skipping = true;
  }

  /** Stop skipping (used once a skipped session reaches its question). */
  settle() {
    this.skipping = false;
  }

  kill() {
    this.killed = true;
    cancelAnimationFrame(this.clockRaf);
  }

  /** Calls `onTick(progress)` each frame for `ms` of active time; progress ends at exactly 1. */
  tween(ms: number, onTick: (p: number) => void): Promise<void> {
    if (this.killed) return Promise.reject(new Cancelled());
    if (this.skipping || ms <= 0) {
      onTick(1);
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      let done = 0;
      let last: number | null = null;
      const frame = (now: number) => {
        if (this.killed) {
          reject(new Cancelled());
          return;
        }
        if (last !== null && !this.paused) done += Math.min(64, now - last);
        last = now;
        if (this.skipping) done = ms;
        const p = Math.min(1, done / ms);
        onTick(p);
        if (p >= 1) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, () => {});
  }
}
