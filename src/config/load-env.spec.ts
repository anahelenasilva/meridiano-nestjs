import { dropEmptyEnvVars } from './load-env';

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
