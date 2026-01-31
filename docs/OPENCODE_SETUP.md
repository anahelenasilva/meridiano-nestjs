# OpenCode Helper Scripts Setup

Quick setup guide for using OpenCode helper scripts in your development workflow.

## Installation

### Option 1: Source the script (Temporary)

Run this in your terminal session:
```bash
source scripts/opencode-helpers.sh
```

### Option 2: Add to your shell profile (Permanent)

Add this line to your `~/.zshrc` (or `~/.bashrc` if using bash):

```bash
# OpenCode helpers for Meridiano project
source /path-to-project/meridiano-nestjs/scripts/opencode-helpers.sh
```

Then reload your shell:
```bash
source ~/.zshrc
```

### Option 3: Add aliases directly (Minimal)

Add these to your `~/.zshrc`:

```bash
# OpenCode shortcuts
alias oc='opencode'
alias ocp='cd /path-to-project/meridiano-nestjs && opencode'
```

## Usage

After setup, you can use:

```bash
# Quick launcher
ocp

# With ultrawork keyword
ocu "refactor all services to use dependency injection"

# Specific agents
oc-sisyphus "implement user authentication"
oc-oracle "debug the queue processing issue"
oc-librarian "find all authentication implementations"
oc-explore "search for database connection patterns"

# Planner mode
oc-plan "design email notification system"

# Check status
oc-status

# Show help
oc-help
```

## Examples

### Complex Refactoring
```bash
ocu "migrate all database queries to use TypeORM repositories"
```

### Feature Implementation
```bash
ocu "add email notifications when articles are bookmarked"
```

### Architecture Review
```bash
oc-oracle "review the authentication flow and suggest improvements"
```

### Code Exploration
```bash
oc-explore "find all places where we use Redis"
oc-librarian "document the briefing generation process"
```

## Integration with Cursor

1. Use Cursor for quick tasks and code review
2. Use OpenCode (via helpers) for complex orchestrated tasks
3. Review OpenCode changes in Cursor
4. Iterate between both tools

See [Cursor + OpenCode Workflow Guide](./CURSOR_OPENCODE_WORKFLOW.md) for detailed patterns.
