import * as path from 'node:path';
import * as sandcastle from '@ai-hero/sandcastle';
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox';
import { claudeAgent, writeJson } from '../shared/common';
import { extractionPrompt } from '../shared/extraction-prompt';
import { runWithExtraction } from '../shared/run-with-extraction';
import { explorePlanSchema } from './plan-schema';

const result = await runWithExtraction({
  name: 'explore',
  // Issue text is untrusted, so explore gets only the tools in the allow list
  // agent-explore.yml writes. See docs/agents/explore-threat-model.md.
  agent: claudeAgent('claude-sonnet-5-5', { permissionMode: 'dontAsk' }),
  sandbox: noSandbox(),
  logging: { type: 'stdout' },
  promptFile: path.join(import.meta.dirname, 'prompt.md'),
  output: sandcastle.Output.object({ tag: 'plan', schema: explorePlanSchema }),
  extractionPrompt: extractionPrompt('plan', explorePlanSchema),
});

writeJson('plan.json', result.output);
