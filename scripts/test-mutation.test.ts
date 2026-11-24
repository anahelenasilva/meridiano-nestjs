import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const repoRoot = resolve(__dirname, '..');

// A git hook exports GIT_DIR and GIT_INDEX_FILE, which would point the
// throwaway repo's git calls at this checkout.
const envWithoutGit = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

// MUTATION_DRY_RUN: see scripts/test-mutation.sh.
// --silent drops pnpm's script banner, which echoes the arguments too.
const runTestMutation = (args: string[], cwd = repoRoot) =>
  spawnSync('pnpm', ['--silent', 'test:mutation', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...envWithoutGit, MUTATION_DRY_RUN: '1' },
  });

describe('pnpm test:mutation <file>', () => {
  it('passes the file argument to --mutate', () => {
    const result = runTestMutation(['libs/database/type-parsers.ts']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'libs/database/type-parsers.ts');
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

  it('rejects --base next to a file, since the file is mutated whole', () => {
    const result = runTestMutation([
      'libs/database/type-parsers.ts',
      '--base',
      'main',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--base only applies without a file/);
  });
});

const tenLines = (prefix: string) =>
  Array.from(
    { length: 10 },
    (_, i) => `export const ${prefix}${i + 1} = ${i + 1};`,
  ).join('\n') + '\n';

describe('pnpm test:mutation with no file (changed lines)', () => {
  let repo: string;

  const git = (...args: string[]) => {
    const result = spawnSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      env: envWithoutGit,
    });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  };
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  const commit = (message: string) => {
    git('add', '-A');
    git('commit', '-q', '-m', message);
  };
  const replaceLines = (prefix: string, replaced: Record<number, string>) =>
    tenLines(prefix)
      .split('\n')
      .map((line, i) => replaced[i + 1] ?? line)
      .join('\n');
  const run = (args: string[] = []) => runTestMutation(args, repo);

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'test-mutation-'));
    mkdirSync(join(repo, 'scripts'));
    copyFileSync(
      join(repoRoot, 'scripts/test-mutation.sh'),
      join(repo, 'scripts/test-mutation.sh'),
    );
    write(
      'package.json',
      JSON.stringify({
        scripts: { 'test:mutation': 'bash scripts/test-mutation.sh' },
      }),
    );
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    write('src/a.ts', tenLines('a'));
    write('libs/b.ts', tenLines('b'));
    commit('base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '-q', '-b', 'feature');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('mutates the lines of a multi-line hunk', () => {
    write(
      'src/a.ts',
      replaceLines('a', {
        3: 'export const a3 = 30;',
        4: 'export const a4 = 40;',
        5: 'export const a5 = 50;',
      }),
    );
    commit('edit');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'src/a.ts:3-5');
  });

  it('mutates a one-line hunk as a one-line range', () => {
    write('libs/b.ts', replaceLines('b', { 7: 'export const b7 = 70;' }));
    commit('edit');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'libs/b.ts:7-7');
  });

  it('gives one range per hunk across files', () => {
    write(
      'src/a.ts',
      replaceLines('a', {
        2: 'export const a2 = 20;',
        9: 'export const a9 = 90;',
      }),
    );
    write('libs/b.ts', replaceLines('b', { 1: 'export const b1 = 10;' }));
    commit('edit');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'libs/b.ts:1-1,src/a.ts:2-2,src/a.ts:9-9',
    );
  });

  it('gives no range for a pure deletion', () => {
    write(
      'src/a.ts',
      tenLines('a')
        .split('\n')
        .filter((_, i) => i !== 4)
        .join('\n'),
    );
    commit('delete a line');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'test:mutation: no changed lines in src/ or libs/ to mutate',
    );
  });

  it('gives no range for a deleted file', () => {
    unlinkSync(join(repo, 'libs/b.ts'));
    write('src/a.ts', replaceLines('a', { 6: 'export const a6 = 60;' }));
    commit('delete a file');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'src/a.ts:6-6');
  });

  it('mutates an untracked new file whole', () => {
    write('src/new/c.ts', tenLines('c'));

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'src/new/c.ts');
  });

  it('counts an uncommitted edit', () => {
    write('src/a.ts', replaceLines('a', { 10: 'export const a10 = 100;' }));

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'src/a.ts:10-10');
  });

  it('skips specs, modules, the bootstrap, mocks, migrations, CLI scripts and non-ts files', () => {
    write('src/a.spec.ts', tenLines('s'));
    write('src/a.module.ts', tenLines('m'));
    write('src/main.ts', tenLines('main'));
    write('src/__mocks__/lib.ts', tenLines('mock'));
    write('src/database/migrations/1-Add.ts', tenLines('mig'));
    write('src/scripts/runThing.ts', tenLines('cli'));
    write('libs/b.json', '{}\n');
    write('test/a.e2e-spec.ts', tenLines('e2e'));
    write('scripts/other.ts', tenLines('o'));
    commit('only files that are not mutated');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'test:mutation: no changed lines in src/ or libs/ to mutate',
    );
  });

  it('prints the "no changed lines" line for a spec-only change', () => {
    write('libs/b.spec.ts', tenLines('spec'));
    commit('spec');
    write('src/a.spec.ts', tenLines('untracked-spec'));

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'test:mutation: no changed lines in src/ or libs/ to mutate',
    );
  });

  it('diffs from the merge base, so changes on the base after the fork do not count', () => {
    write('src/a.ts', replaceLines('a', { 1: 'export const a1 = 10;' }));
    commit('feature edit');
    git('checkout', '-q', 'main');
    write('libs/b.ts', replaceLines('b', { 2: 'export const b2 = 20;' }));
    commit('main moves on');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '-q', 'feature');

    const result = run();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'src/a.ts:1-1');
  });

  it('diffs against --base for a branch stacked on another', () => {
    write('src/a.ts', replaceLines('a', { 1: 'export const a1 = 10;' }));
    commit('parent branch edit');
    git('branch', 'parent');
    write('libs/b.ts', replaceLines('b', { 4: 'export const b4 = 40;' }));
    commit('stacked edit');

    const result = run(['--base', 'parent']);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'libs/b.ts:4-4');
  });

  it('accepts --base=<ref> like --base <ref>', () => {
    write('src/a.ts', replaceLines('a', { 1: 'export const a1 = 10;' }));
    commit('parent branch edit');
    git('branch', 'parent');
    write('libs/b.ts', replaceLines('b', { 4: 'export const b4 = 40;' }));
    commit('stacked edit');

    const result = run(['--base=parent']);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'libs/b.ts:4-4');
  });

  it('fails with usage when --base has no ref', () => {
    const result = run(['--base']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /--base needs a git ref\. Usage:/);
    assert.equal(result.stdout, '');
  });

  it('fails with usage on an unknown option', () => {
    const result = run(['--nope']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown option --nope\. Usage:/);
    assert.equal(result.stdout, '');
  });

  it('exits 1 naming --base when git cannot diff against the base', () => {
    const result = run(['--base', 'nope']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot diff against nope; pass --base <ref>/);
    assert.equal(result.stderr.trim().split('\n').length, 1);
    assert.equal(result.stdout, '');
  });

  it('exits 1 naming --base when origin/main is missing', () => {
    git('update-ref', '-d', 'refs/remotes/origin/main');

    const result = run();

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /cannot diff against origin\/main; pass --base <ref>/,
    );
  });
});
