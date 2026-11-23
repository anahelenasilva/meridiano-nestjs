import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

// MUTATION_DRY_RUN: see scripts/test-mutation.sh.
// --silent drops pnpm's script banner, which echoes the arguments too.
const runTestMutation = (args: string[]) =>
  spawnSync('pnpm', ['--silent', 'test:mutation', ...args], {
    encoding: 'utf8',
    env: { ...process.env, MUTATION_DRY_RUN: '1' },
  });

describe('pnpm test:mutation', () => {
  it('passes the file argument to --mutate', () => {
    const result = runTestMutation(['libs/database/type-parsers.ts']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'libs/database/type-parsers.ts');
  });

  it('fails with usage when no file is given', () => {
    const result = runTestMutation([]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage: pnpm test:mutation <file>/);
    assert.equal(result.stdout, '');
  });

  it('fails with usage when more than one file is given', () => {
    const result = runTestMutation([
      'libs/database/type-parsers.ts',
      'libs/database/index.ts',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /expected one file, got 2/);
    assert.equal(result.stdout, '');
  });

  it('fails when the file does not exist', () => {
    const result = runTestMutation(['libs/database/no-such-file.ts']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /no file at libs\/database\/no-such-file\.ts/);
    assert.equal(result.stdout, '');
  });
});
