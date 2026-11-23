import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
const skillPath = '.claude/skills/mutation-testing/SKILL.md';
const skill = readFileSync(join(repoRoot, skillPath), 'utf8');

// Trimmed from a real `pnpm test:mutation libs/database/type-parsers.ts`
// report (testFiles, config, framework and per-mutant test data dropped).
// Stryker's clear-text table for that run: 6 killed, 6 survived, 2 no cov.
const survived = 6;
const noCoverage = 2;
const fixture = join(
  import.meta.dirname,
  'fixtures/type-parsers.mutation.json',
);

const skillJqCommand = () => {
  const commands = skill.split('\n').filter((line) => line.startsWith('jq '));
  assert.equal(commands.length, 1, 'the skill has one jq command');
  return commands[0];
};

describe('mutation-testing skill', () => {
  it('lists every Survived and NoCoverage mutant from a real report', () => {
    const command = skillJqCommand().replace(
      'reports/mutation/mutation.json',
      JSON.stringify(fixture),
    );
    const result = spawnSync('bash', ['-c', command], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const rows = result.stdout.trimEnd().split('\n');
    assert.equal(rows.length, survived + noCoverage);
    assert.equal(
      rows.filter((row) => row.includes('\tSurvived\t')).length,
      survived,
    );
    assert.equal(
      rows.filter((row) => row.includes('\tNoCoverage\t')).length,
      noCoverage,
    );
    assert.ok(
      rows.includes(
        'libs/database/type-parsers.ts\t25\tSurvived\tEqualityOperator\toid !== timestampOid',
      ),
    );
  });

  it('reads the path pnpm test:mutation writes', () => {
    assert.match(skillJqCommand(), / reports\/mutation\/mutation\.json$/);
  });
});

describe('implementer prompts', () => {
  for (const prompt of [
    'implement/prompt.md',
    'implement-spec/build-prompt.md',
  ]) {
    it(`${prompt} runs pnpm test:mutation and points at the skill`, () => {
      const text = readFileSync(
        join(import.meta.dirname, '..', prompt),
        'utf8',
      );
      assert.match(text, /run `pnpm test:mutation`/);
      assert.ok(text.includes(skillPath));
      assert.match(text, /score per\s+file/);
      assert.match(text, /Evidence section/);
    });
  }
});
