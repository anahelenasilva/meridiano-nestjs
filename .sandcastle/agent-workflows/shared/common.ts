import * as fs from 'node:fs';
import * as path from 'node:path';
import * as sandcastle from '@ai-hero/sandcastle';

export const outputDir = (): string => process.env.OUTPUT_DIR ?? '/tmp';

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
};

export const writeJson = (filename: string, value: unknown): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(
    path.join(outputDir(), filename),
    JSON.stringify(value, null, 2),
  );
};

// Opus writes and judges code: implement, review, decompose. Sonnet runs the
// read-only explore and the implement-spec chain's builds, which opus reviews.
export type ClaudeModel = 'claude-opus-5-5' | 'claude-sonnet-5-5';

// The one agent every factory workflow runs, called with the model its step
// needs. It authenticates with a Claude subscription. To bill the API
// instead, pass ANTHROPIC_API_KEY here and in the workflow's env in place of
// CLAUDE_CODE_OAUTH_TOKEN.
//
// With no `permissionMode`, Sandcastle runs the agent with its permission
// checks skipped, so it can use any tool. Explore passes `dontAsk` instead:
// Claude Code then denies every tool its settings.json does not allow, and
// agent-explore.yml writes that allow list on its own runner (#409).
export type ClaudePermissionMode = 'dontAsk';

export const claudeAgent = (
  model: ClaudeModel,
  options: { permissionMode?: ClaudePermissionMode } = {},
) =>
  sandcastle.claudeCode(model, {
    env: {
      CLAUDE_CODE_OAUTH_TOKEN: required('CLAUDE_CODE_OAUTH_TOKEN'),
    },
    ...(options.permissionMode && { permissionMode: options.permissionMode }),
  });
