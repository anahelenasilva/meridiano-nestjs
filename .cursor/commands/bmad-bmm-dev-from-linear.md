---
name: 'dev-from-linear'
description: 'Create story files and implement from one or more Linear issue IDs. Use when the user provides Linear IDs like TASK-253 or "TASK-253 TASK-254"'
---

**Usage**: `/bmad-bmm-dev-from-linear TASK-253` or `/bmad-bmm-dev-from-linear TASK-253 TASK-254`
ALWAYS ANSWER IN ENGLISH.
IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. **Parse input**: Extract one or more Linear issue identifiers from the user's message (e.g. `TASK-253`, `TASK-253 TASK-254`, or comma-separated). Normalize to uppercase and strip whitespace.
2. **Resolve BMAD keys**: Load @{project-root}/_bmad-output/implementation-artifacts/linear-issue-map.yaml. Under `issues`, find each entry whose `identifier` matches a provided Linear ID. Map each Linear ID to its BMAD key (the YAML key, e.g. `1-1-trigger-audio-generation-for-transcriptions`). Skip epic entries (keys like `epic-1`, `epic-2`). If any Linear ID has no match, report it and ask the user to confirm or correct.
3. **Branch check**: If the checked-out branch is `main`, create a new branch before implementing. Use format `feat/<feature-name>` or `fix/<bug-name>` based on the task(s) at hand. **Always** run `git fetch && git pull origin main` before creating the new branch.
4. **For each resolved BMAD key** (in the order provided):
   a. **Create story**: LOAD @{project-root}/_bmad/core/tasks/workflow.xml, READ it, and execute the create-story workflow from @{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml, passing the story key (e.g. `1.1` or `1-1-trigger-audio-generation-for-transcriptions`) as the target story to create.
   b. **Implement story**: LOAD @{project-root}/_bmad/core/tasks/workflow.xml, READ it, and execute the dev-story workflow from @{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml, using the story file generated in step 4a.
5. **Re-sync** (optional but recommended): After all stories are implemented, run the sprint-planning workflow from @{project-root}/_bmad/custom/bmm/workflows/4-implementation/sprint-planning/workflow.yaml to keep sprint-status.yaml and Linear aligned. **Do not mark the Linear issues as Done**—keep their status as **In Progress**.
6. **Review and fix** (after implementing everything):
   a. Review all changes you made.
   b. Categorize review findings by impact: **Critical**, **High**, and **Medium**.
   c. Include a separate list of suggestions.
   d. Fix all **Critical**, **High**, and **Medium** issues you identified.
   e. Output the suggestions.
   f. Output a commit message for those changes.
7. **Summary**: Report which Linear IDs were processed, which BMAD keys they mapped to, and any issues encountered.
</steps>

<note>
- BMAD is the planning/spec source; Linear is the execution/visibility layer. Do not implement from Linear text alone if it diverges from the BMAD story.
- If the create-story workflow path differs (e.g. custom override), use the path that exists under @{project-root}/_bmad.
- **Linear status**: Do not mark Linear issues as Done. Keep them as In Progress.
</note>
