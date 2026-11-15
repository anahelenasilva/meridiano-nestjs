type Reply = [Error | null, unknown];

interface Entry {
  value: number;
  expiresAt: number | null;
}

/**
 * Test stand-in for the Redis client `RateLimitService` uses. It only knows the
 * transaction `consume` sends, so a stray extra command fails loudly. Expiry
 * reads `Date.now()`, so jest fake timers move the window.
 */
export class InMemoryRedis {
  private readonly entries = new Map<string, Entry>();
  private connectionError: Error | null = null;

  keys(): string[] {
    return [...this.entries.keys()];
  }

  clear(): void {
    this.entries.clear();
    this.connectionError = null;
  }

  failWith(error: Error): void {
    this.connectionError = error;
  }

  multi() {
    const queued: Array<() => unknown> = [];
    const transaction = {
      set: (key: string, value: number, _px: 'PX', ms: number, _nx: 'NX') => {
        queued.push(() => {
          if (this.live(key)) return null;
          this.entries.set(key, { value, expiresAt: Date.now() + ms });
          return 'OK';
        });
        return transaction;
      },
      incr: (key: string) => {
        queued.push(() => {
          const entry = this.live(key) ?? { value: 0, expiresAt: null };
          entry.value += 1;
          this.entries.set(key, entry);
          return entry.value;
        });
        return transaction;
      },
      pttl: (key: string) => {
        queued.push(() => {
          const entry = this.live(key);
          if (!entry) return -2;
          return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
        });
        return transaction;
      },
      exec: (): Promise<Reply[]> => {
        if (this.connectionError) return Promise.reject(this.connectionError);
        return Promise.resolve(queued.map((run): Reply => [null, run()]));
      },
    };
    return transaction;
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt != null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
}
