import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { dropEmptyEnvVars, loadEnv } from './load-env';

describe('loadEnv', () => {
  const KEY = 'MERIDIANO_LOAD_ENV_SPEC_KEY';
  const originalCwd = process.cwd();
  let envFile: string;

  /**
   * Every caller runs `loadEnv()` with no arguments, so dotenv resolves `.env`
   * from the cwd. Moving into a tmp dir is how the spec hands it a file without
   * touching the real one.
   */
  function chdirToEnvFile(contents: string): void {
    envFile = join(mkdtempSync(join(tmpdir(), 'load-env-spec-')), '.env');
    writeFileSync(envFile, contents);
    process.chdir(join(envFile, '..'));
  }

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env[KEY];
    unlinkSync(envFile);
    rmdirSync(join(envFile, '..'));
  });

  it('fills a variable the shell exported empty from .env', () => {
    chdirToEnvFile(`${KEY}=from-dotenv\n`);
    process.env[KEY] = '';

    loadEnv();

    expect(process.env[KEY]).toBe('from-dotenv');
  });

  it('keeps the value the shell exported over the one in .env', () => {
    chdirToEnvFile(`${KEY}=from-dotenv\n`);
    process.env[KEY] = 'from-shell';

    loadEnv();

    expect(process.env[KEY]).toBe('from-shell');
  });
});

describe('dropEmptyEnvVars', () => {
  it('drops a variable exported as an empty string', () => {
    const env = { OPENAI_API_KEY: '' };

    dropEmptyEnvVars(env);

    expect('OPENAI_API_KEY' in env).toBe(false);
  });

  it('drops a variable holding only whitespace', () => {
    const env = { OPENAI_API_KEY: '   ' };

    dropEmptyEnvVars(env);

    expect('OPENAI_API_KEY' in env).toBe(false);
  });

  it('keeps the string "false"', () => {
    const env = { FEATURE_ENABLED: 'false' };

    dropEmptyEnvVars(env);

    expect(env.FEATURE_ENABLED).toBe('false');
  });

  it('keeps the string "0"', () => {
    const env = { RETRY_COUNT: '0' };

    dropEmptyEnvVars(env);

    expect(env.RETRY_COUNT).toBe('0');
  });

  it('keeps an ordinary value', () => {
    const env = { DATABASE_HOST: 'localhost' };

    dropEmptyEnvVars(env);

    expect(env.DATABASE_HOST).toBe('localhost');
  });
});
