import * as dotenv from 'dotenv';

/**
 * A variable exported empty counts as unset, so the value in `.env` fills it.
 * dotenv's `override: false` tests only key presence
 * (`dotenv/lib/main.js:394`), so without this a stray `export OPENAI_API_KEY=`
 * beats a correct `.env` and the app fails as if the key were missing.
 *
 * Takes the env object so a spec can run it against a plain object.
 */
export function dropEmptyEnvVars(env: NodeJS.ProcessEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (value?.trim() === '') {
      delete env[key];
    }
  }
}

/**
 * Call this where `dotenv.config()` used to sit, so module load order and the
 * rule that an already-exported variable wins over `.env` both hold.
 */
export function loadEnv(): void {
  dropEmptyEnvVars(process.env);
  dotenv.config({ override: false });
}
