# This file replaces Macroscope's default ignore list, so it repeats the
# defaults that match files in this repo. Test files stay out of review
# through Macroscope's test detection. Ignored files are not billed.

# Dependencies and build output
**/node_modules/**
**/.pnpm-store/**
**/dist/**
**/cdk.out/**
**/*.d.ts

# Manifests, lock and data files (openapi.json is generated and CI-checked)
**/package.json
**/pnpm-lock.yaml
**/*.lock
**/*.json
**/*.jsonl
**/*.csv
**/*.log
**/*.png
**/*.svg

# Docs and agent tooling: prose, not runtime code
**/*.md
docs/**
_bmad/**
_bmad-output/**
.sandcastle/**
.codex/**
.claude/**
tasks/**
prompts/**
