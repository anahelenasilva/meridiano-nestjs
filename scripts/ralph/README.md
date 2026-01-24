# Ralph - Autonomous Coding Agent for Cursor Chat

Ralph is an autonomous coding agent that works through user stories in a PRD (Product Requirements Document) iteratively. This version is designed to work inside Cursor chat instead of using external CLI tools like `amp` or `claude`.

This was inspired by [snarktank/ralph](https://github.com/snarktank/ralph).

## How It Works

Ralph reads a `prd.json` file containing user stories, then executes them one by one following the instructions in `prompt.md`. After each story is completed, it moves to the next highest priority story until all are done.

### 1. How to generate the PRD file

In Cursor chat, use the PRD skill to generate a detailed requirements document:
```plaintext
/generate-prd create a PRD for moving the S3 modules to a lib structure inside this project
```

Answer the clarifying questions. The skill saves output to `tasks/prd-[feature-name].md`.

### 2. How to convert PRD to Ralph format

In Cursor chat, use the Ralph skill to convert the markdown PRD to JSON:
```plaintext
/ralph convert tasks/prd-[feature-name].md to prd.json
```

### 3. Run Ralph

In Cursor chat, simply reference the script:

```plaintext
@scripts/ralph/ralph.ts
```

Default is 10 iterations. Use `--tool amp` or `--tool claude` to select your AI coding tool.

Ralph will:

1. Create a feature branch (from PRD `branchName`)
2. Pick the highest priority story where `passes: false`
3. Implement that single story
4. Run quality checks (typecheck, tests)
5. Commit if checks pass
6. Update `prd.json` to mark story as `passes: true`
7. Append learnings to `progress.txt`
8. Repeat until all stories pass or max iterations reached

## Usage in Cursor Chat

### Method 1: Reference the Script Directly

In Cursor chat, simply reference the script:

```
@scripts/ralph/ralph.ts
```

This will load the script and execute one iteration, showing you:
- The current status (completed/total stories)
- The next story to work on
- The full prompt instructions
- Current progress log

Then you (or the AI assistant) can execute the instructions to implement the story.

### Method 2: Run via Terminal

Run a single iteration:
```bash
pnpm ralph:single
```

Or run with a max iteration limit:
```bash
pnpm ralph --max-iterations 5
```

## Workflow

1. **Start**: Reference `@scripts/ralph/ralph.ts` in Cursor chat or run `pnpm ralph:single`
2. **Review**: The script shows the next story to implement and the instructions
3. **Execute**: Follow the instructions in `prompt.md` to implement the story
4. **Update**: Mark the story as complete in `prd.json` by setting `passes: true`
5. **Continue**: Run the script again to move to the next story

## Files

- `prd.json` - Product Requirements Document with user stories
- `prompt.md` - Instructions for the AI agent
- `progress.txt` - Progress log (auto-created)
- `.last-branch` - Tracks the current branch
- `ralph.ts` - Main script (TypeScript version for Cursor chat)
- `ralph.sh` - Original bash script (uses amp/claude CLI)

## Key Differences from CLI Version

The TypeScript version (`ralph.ts`) is designed for Cursor chat:

- No external CLI dependencies (`amp` or `claude`)
- Works directly in Cursor chat by referencing the file
- Provides all context needed for the AI to execute tasks
- Tracks progress and manages iterations
- Auto-archives previous runs when branch changes

## Example Session

```
You: @scripts/ralph/ralph.ts

[Ralph shows next story and instructions]

You: [Execute the instructions to implement the story]

You: [After completing, update prd.json]

You: @scripts/ralph/ralph.ts

[Ralph shows next story...]
```

## Completion

When all stories have `passes: true` in `prd.json`, Ralph will report completion and exit.
