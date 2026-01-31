#!/bin/bash

# OpenCode Helper Scripts for Meridiano Project
# Source this file or add functions to your ~/.zshrc

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Quick OpenCode launcher with project context
ocp() {
  cd "$PROJECT_ROOT" || return
  if [ -z "$1" ]; then
    opencode
  else
    opencode "$@"
  fi
}

# OpenCode with ultrawork keyword helper
ocu() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  if [ -z "$task" ]; then
    echo "Usage: ocu <task description>"
    echo "Example: ocu add authentication to articles endpoint"
    return 1
  fi
  echo "Starting OpenCode with ultrawork: $task"
  opencode <<EOF
$task ultrawork
EOF
}

# OpenCode for specific agent types
oc-sisyphus() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  opencode <<EOF
@sisyphus $task
EOF
}

oc-oracle() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  opencode <<EOF
@oracle $task
EOF
}

oc-librarian() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  opencode <<EOF
@librarian $task
EOF
}

oc-explore() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  opencode <<EOF
@explore $task
EOF
}

# OpenCode with Prometheus (Planner mode)
oc-plan() {
  cd "$PROJECT_ROOT" || return
  local task="$*"
  echo "Entering Prometheus (Planner) mode..."
  opencode <<EOF
@prometheus $task
EOF
}

# Show OpenCode status
oc-status() {
  echo "OpenCode Version: $(opencode --version 2>/dev/null | head -1)"
  echo ""
  echo "Configuration:"
  if [ -f ~/.config/opencode/opencode.json ]; then
    cat ~/.config/opencode/opencode.json | grep -A 5 "plugin"
  fi
  echo ""
  if [ -f ~/.config/opencode/oh-my-opencode.json ]; then
    echo "OhMyOpenCode Agents:"
    cat ~/.config/opencode/oh-my-opencode.json | grep -A 2 '"agents"' | head -20
  fi
}

# Help function
oc-help() {
  cat <<EOF
OpenCode Helper Commands for Meridiano Project

Quick Commands:
  ocp                    - Launch OpenCode in project directory
  ocu <task>             - Launch OpenCode with ultrawork keyword
  oc-status              - Show OpenCode configuration status

Agent-Specific Commands:
  oc-sisyphus <task>     - Use Sisyphus agent (main orchestrator)
  oc-oracle <task>       - Use Oracle agent (architecture/debugging)
  oc-librarian <task>    - Use Librarian agent (docs/code search)
  oc-explore <task>      - Use Explore agent (fast codebase grep)
  oc-plan <task>         - Use Prometheus agent (planner mode)

Examples:
  ocp
  ocu "refactor all services to use dependency injection"
  oc-sisyphus "implement user authentication"
  oc-plan "add email notification system"
  oc-status

For more information, see: docs/CURSOR_OPENCODE_WORKFLOW.md
EOF
}

# Auto-complete helper (for zsh)
if [ -n "$ZSH_VERSION" ]; then
  _ocu() {
    _arguments '1: :()'
  }
  compdef _ocu ocu oc-sisyphus oc-oracle oc-librarian oc-explore oc-plan
fi
