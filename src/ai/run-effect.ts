import { Cause, Effect, Exit } from 'effect';

/**
 * Runs an Effect at a Promise boundary and rejects with the failure itself.
 * `Effect.runPromise` would reject with a `FiberFailure` wrapper, and callers
 * match on the original error's class and message.
 */
export async function runPromiseOrThrow<A, E>(
  program: Effect.Effect<A, E>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(program);
  if (Exit.isSuccess(exit)) return exit.value;
  throw Cause.squash(exit.cause);
}
