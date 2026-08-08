export const SLEEPER = Symbol('SLEEPER');

/**
 * Seam for the rate-limiting delay between AI calls. Production sleeps for real;
 * tests inject a no-op/spy so pipeline runs stay instant and the delay argument
 * can be asserted.
 */
export interface Sleeper {
  sleep(ms: number): Promise<void>;
}

export class RealSleeper implements Sleeper {
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
