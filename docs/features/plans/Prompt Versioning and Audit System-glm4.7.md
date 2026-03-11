# Prompt Versioning and Audit System
## Problem Statement
The Meridiano system uses AI prompts throughout its pipeline (article summarization, transcription analysis, briefing synthesis, etc.), but currently lacks:
* Ability to track which version of a prompt was used for any given processing job
* Historical record of prompt changes over time
* Auditing capability to review inputs/outputs for specific AI interactions
* Reproducibility when debugging AI-related issues or testing prompt changes
## Current State
**Existing Infrastructure:**
* Prompts stored in `src/config/prompts/` as TypeScript constants (e.g., `articleSummaryPrompt`, `transcriptionSummaryPrompt`)
* `AiService` in `src/ai/ai.service.ts` handles AI calls to DeepSeek, OpenAI, Groq
* Prompts use simple string interpolation with `PromptVariables` interface
* TypeORM database already configured with PostgreSQL
* BullMQ queues for background processing
* Multiple prompt templates: article-summary, brief-synthesis, transcription-analysis, cluster-analysis, impact-rating, etc.
**Current Prompt Usage Pattern:**
```typescript
// Current inline prompt usage
const response = await this.aiService.callChat(
  articleSummaryPrompt.replace('{article_content}', article.raw_content),
  'deepseek',
);
```
## Proposed Solution
### 1. Database Schema for Prompt Versioning
Create new entities to track prompts and their usage:
**`prompt_version` table:**
* `id` (UUID, primary key)
* `name` (text) - e.g., "article-summary-v1"
* `template` (text) - the prompt template with placeholders
* `version` (integer) - numeric version (1, 2, 3...)
* `is_active` (boolean) - whether this version is currently in use
* `description` (text, nullable) - notes about what changed
* `created_at`, `updated_at`
**`prompt_execution` table:**
* `id` (UUID, primary key)
* `prompt_version_id` (UUID, foreign key)
* `input_variables` (jsonb) - the actual variables used
* `prompt_text` (text) - the fully rendered prompt sent to AI
* `ai_provider` (text) - e.g., "deepseek", "openai"
* `ai_model` (text) - e.g., "deepseek-chat"
* `output` (text, nullable) - AI response
* `status` (text) - "success", "error", "timeout"
* `error_message` (text, nullable)
* `duration_ms` (integer)
* `tokens_used` (integer, nullable)
* `cost_estimate_usd` (float, nullable)
* `reference_id` (text, nullable) - link to article/transcription ID
* `reference_type` (text) - "article", "transcription", "briefing"
* `created_at`
**`prompt_tags` table:**
* `id` (UUID, primary key)
* `name` (text, unique) - e.g., "summarization", "classification"
* `prompt_version_id` (UUID, foreign key)
### 2. Prompt Registry Service
Create a `src/prompts/prompt-registry.service.ts` that:
* Loads initial prompt versions from files into database on first run
* Provides methods to `registerPrompt(name, template, description)`
* Supports versioning by detecting hash changes in templates
* `getActivePrompt(name)` - returns the currently active prompt version
* `updatePrompt(name, template, description)` - creates new version, deactivates old
* `listHistory(name)` - returns all versions of a prompt
### 3. Audit Service
Create `src/audit/ai-audit.service.ts` that:
* `logExecution(promptName, variables, aiConfig)` - called before AI call
* `recordSuccess(output, metadata)` - update after successful response
* `recordError(error)` - update on failure
* `getExecutions(referenceId, referenceType)` - retrieve by external reference
* `getExecutionsByPrompt(promptName)` - audit trail for specific prompt
* `analyzePromptUsage(promptName)` - stats on success rates, costs, etc.
### 4. AiService Integration
Refactor `src/ai/ai.service.ts` to:
* Accept `PromptExecutionContext` object instead of raw prompt string
* Automatically create audit record before/after AI calls
* Extract metadata (token usage, duration) from API responses
* Handle errors gracefully, ensuring audit record is always created
**Before:**
```typescript
const response = await this.aiService.callChat(
  articleSummaryPrompt.replace('{article_content}', article.raw_content),
  'deepseek',
);
```
**After:**
```typescript
const response = await this.aiService.callChat(
  { promptName: 'article-summary', variables: { article_content: article.raw_content } },
  { provider: 'deepseek' },
  { referenceId: article.id, referenceType: 'article' },
);
```
### 5. Migration and APIs
**Database Migration:**
* Create tables for prompt versioning and audit tracking
* Seed initial prompts from existing templates
**New Endpoints:**
* `GET /api/prompts` - List all prompts with active versions
* `GET /api/prompts/:name` - Get prompt history and versions
* `POST /api/prompts` - Create new prompt version
* `GET /api/ai-audit` - List audit records with filters
* `GET /api/ai-audit/:id` - Get full audit record with input/output
* `GET /api/ai-audit/ref/:referenceId` - Get audits by reference (article/transcription)
### 6. CLI and Scripts
**New commands:**
* `pnpm run prompts:seed` - Load prompts from files to database
* `pnpm run prompts:export` - Export database prompts to files
* `pnpm run prompts:diff` - Compare versions of a prompt
* `pnpm run audit:report` - Generate usage report (cost, success rates, avg response time)
## Implementation Steps
### Phase 1: Core Infrastructure
1. Create database entities and migrations
2. Implement PromptRegistryService with initial seeding
3. Implement AiAuditService with logging/tracking
4. Refactor AiService to integrate with new services
### Phase 2: Integration
5. Update article processors to use new API
6. Update transcription processors to use new API
7. Update briefing generation to use new API
8. Update cluster analysis to use new API
### Phase 3: Visibility
9. Create REST API endpoints for prompt management
10. Create REST API endpoints for audit queries
11. Build CLI tools for prompt management
12. Add admin UI for viewing prompt executions (optional)
### Phase 4: Analysis
13. Implement cost tracking (token usage × model pricing)
14.Implement success/failure rate analytics
15. Implement A/B testing capability (multiple active versions)
16. Build comparison tools for prompt differences
## Technical Considerations
**Performance:**
* Audit records can grow large - implement pruning strategy (keep 90 days)
* Batch inserts for audit records in high-volume scenarios
* Consider read replica for audit queries
**Backwards Compatibility:**
* Keep old string-based API for existing code
* Provide migration path for each processor
* Gradual rollout per module to minimize disruption
**Security:**
* Admin-only access to prompt management endpoints
* Sanitize sensitive data before storing in audit (PII redaction)
* Manage secrets/API keys at service level, not prompt level
**Extensibility:**
* Support for A/B testing prompts (multiple active versions)
* Tag-based organization for prompts
* Export/import prompt versions for transfer between environments
## Success Metrics
* All AI interactions tracked in audit table
* 100% reproducibility for any past processing job
* Ability to identify which prompt version caused issues
* Visibility into AI costs and usage patterns
* Easy rollback capability for prompt changes
## Future Enhancements
* Automatic prompt optimization based on success metrics
* Integration with feature flags for gradual rollouts
* Prompt performance dashboards
* Historical price tracking for token cost estimation
* CI/CD integration for prompt version testing
