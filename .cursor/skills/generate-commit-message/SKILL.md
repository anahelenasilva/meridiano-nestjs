---
name: generate-commit-message
description: Generate commit messages following Conventional Commits specification by analyzing git diffs and staged changes. Use when the user asks for a commit message, wants to commit changes, or needs help writing commit messages.
---

# Generate Commit Message

Generate commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification by analyzing git changes.

## Process

1. **Analyze changes**: Run `git diff --cached` for staged changes or `git diff` for unstaged changes
2. **Determine type**: Identify the primary change type from the diff
3. **Identify scope**: Extract the affected module/component (optional but recommended)
4. **Write description**: Create a concise, imperative-mood description
5. **Add body** (if needed): Include context for complex changes
6. **Check for breaking changes**: Look for API changes, removed features, or schema changes

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add JWT token refresh` |
| `fix` | Bug fix | `fix(reports): correct date formatting` |
| `docs` | Documentation only | `docs: update API documentation` |
| `style` | Formatting, missing semicolons | `style: format code with prettier` |
| `refactor` | Code restructuring | `refactor(users): extract validation logic` |
| `perf` | Performance improvement | `perf(db): optimize query with index` |
| `test` | Adding/updating tests | `test(auth): add login tests` |
| `chore` | Build tasks, dependencies | `chore: update dependencies` |
| `build` | Build system changes | `build: update webpack config` |
| `ci` | CI/CD changes | `ci: add GitHub Actions workflow` |

## Scope Guidelines

- Use module/component name: `feat(auth)`, `fix(articles)`, `refactor(database)`
- Use library name for libs: `feat(s3)`, `fix(email)`
- Omit scope for broad changes: `chore: update dependencies`
- Use lowercase, no spaces

## Description Guidelines

- Use imperative mood: "add feature" not "added feature" or "adds feature"
- Lowercase (except proper nouns)
- No period at the end
- Keep under 72 characters when possible
- Be specific: "fix date parsing bug" not "fix bug"

## Breaking Changes

Indicate breaking changes with `!` after type/scope or `BREAKING CHANGE:` footer:

```
feat(api)!: change response format

BREAKING CHANGE: API now returns objects instead of arrays
```

Or:

```
feat!: remove deprecated endpoint
```

## Examples

### Simple feature
```
feat(auth): add password reset functionality
```

### Bug fix with scope
```
fix(reports): correct timezone handling in date filters
```

### Refactor with body
```
refactor(database): extract query builder logic

Move complex SQL generation to dedicated QueryBuilder class
to improve testability and maintainability.
```

### Breaking change
```
feat(api)!: change pagination response structure

BREAKING CHANGE: Pagination now uses `page` and `per_page` instead of `offset` and `limit`
```

### Multiple changes
If changes span multiple types, focus on the primary change or split into multiple commits:

```
feat(articles): add article categorization

- Add category field to article entity
- Update article service with category filtering
- Add category filter to article controller
```

## Analysis Tips

1. **File patterns**: 
   - New files → usually `feat`
   - Test files → `test`
   - Config files → `chore` or `build`
   - Documentation → `docs`

2. **Change patterns**:
   - Adding exports/endpoints → `feat`
   - Fixing logic errors → `fix`
   - Reorganizing code → `refactor`
   - Performance optimizations → `perf`

3. **Scope detection**:
   - Look at directory structure: `src/articles/` → `articles`
   - Check module names: `ArticlesModule` → `articles`
   - Library modules: `libs/s3/` → `s3`

4. **Breaking changes**:
   - Removed exports/functions
   - Changed function signatures
   - Changed response formats
   - Database schema changes (migrations)

## Output Format

Provide the commit message ready to use:

```bash
git commit -m "feat(scope): description"
```

For multi-line messages, format as:

```bash
git commit -m "feat(scope): description" -m "Additional context line 1" -m "Additional context line 2"
```

Or use a commit message file if body is long.
