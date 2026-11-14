import { createHash, timingSafeEqual } from 'crypto';

export type CredentialCheck = 'valid' | 'missing' | 'invalid';

type HeaderSource = {
  headers?: Record<string, string | string[] | undefined>;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * A secret configured in env (`MERIDIANO_API_KEY`, `EXTERNAL_API_TOKENS`) and
 * presented in a request header. Guards map `check` to allow, fall through or
 * 401. Unset or empty config never accepts a request.
 */
export class StaticCredential {
  private constructor(private readonly digests: readonly Buffer[]) {}

  static from(configured: string | readonly string[] | undefined) {
    const entries =
      typeof configured === 'string' ? [configured] : (configured ?? []);
    return new StaticCredential(entries.filter(Boolean).map(sha256));
  }

  check(request: HeaderSource, header: string): CredentialCheck {
    const presented = readHeader(request, header);
    if (presented === undefined) {
      return 'missing';
    }
    return this.matchingDigest(presented) ? 'valid' : 'invalid';
  }

  /**
   * Hex sha256 of the presented value when it matches, else null. Safe to use
   * as a storage key, since the raw secret never leaves this module.
   */
  verifiedDigest(request: HeaderSource, header: string): string | null {
    const presented = readHeader(request, header);
    return presented === undefined ? null : this.matchingDigest(presented);
  }

  /**
   * Comparing digests keeps every timingSafeEqual call at equal length, and
   * every entry is compared so the time does not reveal which one matched.
   */
  private matchingDigest(presented: string): string | null {
    const digest = sha256(presented);
    const matches = this.digests.filter((entry) =>
      timingSafeEqual(digest, entry),
    );
    return matches.length > 0 ? digest.toString('hex') : null;
  }
}

/** The header value, or undefined when it is absent or blank. Arrays use their first value. */
function readHeader(request: HeaderSource, header: string): string | undefined {
  const raw = request.headers?.[header];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value : undefined;
}
