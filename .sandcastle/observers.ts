import type { AgentStreamEvent } from "@ai-hero/sandcastle";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_RUNS_DB_ID = process.env.NOTION_RUNS_DB_ID;

export interface RunContext {
  task: string;
  branch: string;
  issueNumber?: string;
  logPath: string;
}

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

export function logEventToConsole(event: AgentStreamEvent) {
  if (event.type === "text") {
    process.stdout.write(event.message);
  } else {
    console.log(`\n[tool:${event.iteration}] ${event.name}(${event.formattedArgs})`);
  }
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

function slackPost(text: string) {
  if (!SLACK_WEBHOOK_URL) return;
  fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export function notifySlackStart(ctx: RunContext) {
  slackPost(
    `🤖 *Sandcastle run started*\nTask: \`${ctx.task}\`${ctx.branch ? `\nBranch: \`${ctx.branch}\`` : ""}${ctx.issueNumber ? `\nIssue: #${ctx.issueNumber}` : ""}`,
  );
}

export function notifySlackToolCall(event: Extract<AgentStreamEvent, { type: "toolCall" }>) {
  slackPost(`[tool] \`${event.name}\`\n\`\`\`${event.formattedArgs}\`\`\``);
}

export function notifySlackComplete(ctx: RunContext, durationSec: number, commits: number, iterations: number) {
  slackPost(
    `✅ *Sandcastle run complete*\nTask: \`${ctx.task}\` · ${durationSec}s · ${iterations} iteration(s) · ${commits} commit(s)\nLog: \`${ctx.logPath}\``,
  );
}

export function notifySlackError(ctx: RunContext, durationSec: number, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  slackPost(
    `❌ *Sandcastle run failed*\nTask: \`${ctx.task}\` · ${durationSec}s\nError: ${message}`,
  );
}

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------

function notionPost(status: "Success" | "Failed", ctx: RunContext, durationSec: number, extra: Record<string, unknown> = {}) {
  if (!NOTION_TOKEN || !NOTION_RUNS_DB_ID) return;

  const body = {
    parent: { database_id: NOTION_RUNS_DB_ID },
    properties: {
      Name: { title: [{ text: { content: `[${status}] ${ctx.task}${ctx.issueNumber ? ` #${ctx.issueNumber}` : ""}` } }] },
      Status: { select: { name: status } },
      Task: { rich_text: [{ text: { content: ctx.task } }] },
      Branch: { rich_text: [{ text: { content: ctx.branch } }] },
      "Duration (s)": { number: durationSec },
      "Log Path": { rich_text: [{ text: { content: ctx.logPath } }] },
      ...extra,
    },
  };

  fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function recordNotionSuccess(ctx: RunContext, durationSec: number, commits: number, iterations: number) {
  notionPost("Success", ctx, durationSec, {
    Commits: { number: commits },
    Iterations: { number: iterations },
  });
}

export function recordNotionError(ctx: RunContext, durationSec: number, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  notionPost("Failed", ctx, durationSec, {
    Error: { rich_text: [{ text: { content: message } }] },
  });
}
