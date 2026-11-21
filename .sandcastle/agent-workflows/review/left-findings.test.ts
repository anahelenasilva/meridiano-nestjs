import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addLeftFindings } from './left-findings';
import type { ReviewComment } from './review-schema';

const finding = (overrides: Partial<ReviewComment>): ReviewComment => ({
  axis: 'standards',
  title: 'Server module imports a UI component',
  path: 'app/modules/a/lib/b.server.ts',
  line: 4,
  body: '**Wrong direction.**\n\nMove the type.',
  ...overrides,
});

const verdict = [
  '## Standards: CHANGES REQUESTED',
  'One line.',
  '',
  '## Spec: PASS',
  'Met.',
  '',
  '## Rules this review wanted and could not find',
  '- None.',
  '',
].join('\n');

describe('addLeftFindings', () => {
  it('leaves a verdict with no findings unchanged', () => {
    assert.equal(addLeftFindings(verdict, [], []), verdict);
  });

  it('lists an inline finding by title and line only', () => {
    const result = addLeftFindings(verdict, [finding({})], []);

    assert.ok(
      result.includes(
        'One line.\n\n**Left**\n\n- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n\n## Spec: PASS',
      ),
    );
    assert.ok(!result.includes('Move the type.'));
  });

  it('writes a dropped finding out in full, indented under its entry', () => {
    const result = addLeftFindings(verdict, [], [finding({})]);

    assert.ok(
      result.includes(
        '- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n\n  **Wrong direction.**\n\n  Move the type.\n\n## Spec: PASS',
      ),
    );
  });

  it('puts each finding under its own axis', () => {
    const result = addLeftFindings(
      verdict,
      [finding({ axis: 'spec', title: 'Scope creep' })],
      [],
    );

    assert.ok(
      result.includes('## Standards: CHANGES REQUESTED\nOne line.\n\n## Spec'),
    );
    assert.ok(
      result.includes(
        'Met.\n\n**Left**\n\n- **Scope creep**, at `app/modules/a/lib/b.server.ts:4`\n\n## Rules',
      ),
    );
  });

  it('lists inline findings before dropped ones', () => {
    const result = addLeftFindings(
      verdict,
      [finding({ title: 'Inline' })],
      [finding({ title: 'Dropped' })],
    );

    assert.ok(result.indexOf('**Inline**') < result.indexOf('**Dropped**'));
  });

  it('adds the axis heading when the verdict has none', () => {
    const result = addLeftFindings('No verdict.\n', [finding({})], []);

    assert.equal(
      result,
      'No verdict.\n\n## Standards\n\n**Left**\n\n- **Server module imports a UI component**, at `app/modules/a/lib/b.server.ts:4`\n',
    );
  });
});
