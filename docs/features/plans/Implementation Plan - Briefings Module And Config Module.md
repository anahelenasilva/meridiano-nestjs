# Implementation Plan - Briefings Module And Config Module

## Fix: ConfigService cross-module coupling (BriefingOptions import)

**Problem:** `config.service.ts:2` imports `BriefingOptions` from `../briefings/entities/briefing.types`. Config module must not depend on Briefings — the dependency arrow is inverted.

**Target state:** `BriefingOptions` lives in `src/shared/types/briefing.ts`. Both `config/` and `briefings/` import from `shared/`.

### Steps

1. **Create `src/shared/types/briefing.ts`**
   Move `BriefingOptions` from `briefing.types.ts` into this new file. Export it.

2. **Update `briefing.types.ts`**
   Remove the `BriefingOptions` interface. Re-export it from `shared/types/briefing.ts` if any internal briefings code imports it directly from this path (check with grep).

3. **Update `config.service.ts:2`**
   Change import from `../briefings/entities/briefing.types` → `../shared/types/briefing`.

4. **Update all other consumers**
   Run: `grep -rn "BriefingOptions" src --include="*.ts"`
   Update each import to point to `shared/types/briefing`.

5. **Verify no circular deps**
   Run `pnpm exec madge --circular src/` (or equivalent) to confirm no new cycles.

6. **Run tests**
   `pnpm exec jest` — all suites must pass.

### Acceptance criteria
- `config/` imports nothing from `briefings/`
- `BriefingOptions` is importable from `shared/types/briefing`
- All tests pass
- No circular dependency warnings
