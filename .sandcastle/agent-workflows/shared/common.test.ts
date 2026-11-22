import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { claudeAgent } from './common';

const printCommand = (agent: ReturnType<typeof claudeAgent>): string =>
  agent.buildPrintCommand({
    prompt: 'hello',
    dangerouslySkipPermissions: true,
  }).command;

describe('claudeAgent', () => {
  before(() => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN ??= 'test-token';
  });

  it('skips permission checks when no mode is given, as the other workflows expect', () => {
    const command = printCommand(claudeAgent('claude-opus-5-5'));
    assert.match(command, / --dangerously-skip-permissions /);
    assert.doesNotMatch(command, /--permission-mode/);
  });

  it('runs in dontAsk mode, without skipping permissions, when explore asks for it', () => {
    const command = printCommand(
      claudeAgent('claude-sonnet-5-5', { permissionMode: 'dontAsk' }),
    );
    assert.match(command, / --permission-mode dontAsk /);
    assert.doesNotMatch(command, /--dangerously-skip-permissions/);
  });

  it('also uses dontAsk for the interactive command', () => {
    const agent = claudeAgent('claude-sonnet-5-5', {
      permissionMode: 'dontAsk',
    });
    assert.ok(agent.buildInteractiveArgs);
    const args = agent.buildInteractiveArgs({
      prompt: '',
      dangerouslySkipPermissions: true,
    });
    assert.deepEqual(args.slice(0, 3), [
      'claude',
      '--permission-mode',
      'dontAsk',
    ]);
  });

  it('passes the OAuth token to the agent env', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-from-env';
    assert.deepEqual(claudeAgent('claude-opus-5-5').env, {
      CLAUDE_CODE_OAUTH_TOKEN: 'token-from-env',
    });
  });
});
