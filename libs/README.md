# Libs Directory

A lib in `libs/` is a shared infrastructure module or cross-cutting concern that more than one domain module in `src/` uses. Each lib's behavior, gotchas and env vars are in [docs/LIBRARIES.md](../docs/LIBRARIES.md).

## What Belongs in `libs/` vs `src/`

### `libs/`: infrastructure and shared modules
- **Shared infrastructure modules**: S3, email, database, redis, queue
- **Reusable utilities** used across multiple domain modules
- **Cross-cutting concerns** that don't belong to a specific domain

### `src/`: domain logic
- **Domain-specific modules**: articles, users, briefings, etc.
- **Business logic and use cases**
- **API controllers and routes**
- **Domain entities and DTOs**

## Import Conventions

### Import a lib only through its root files

A lib's root files are its entry points. Its subfolders (`constants/`, `interfaces/`, `services/`) are internals: the lib's own files import them freely, and nothing outside the lib may.

```typescript
// ✅ Entry points: root files of the lib
import { QueueModule, NEWS_DIGEST_QUEUE } from '@libs/queue';
import { createWorker } from '@libs/queue/create-worker';
import type { GenerateAudioJobData } from '@libs/audio';

// ❌ Internals: a file in a lib's subfolder
import { NEWS_DIGEST_QUEUE } from '@libs/queue/constants/queue.constants';

// ❌ Relative paths into libs
import { S3Service } from '../../libs/s3/s3.service';
```

To make something public, export it from a root file. Prefer several small entry points (`create-worker.ts` next to `index.ts`) over one `index.ts` that re-exports the whole lib, so a caller loads only what it uses.

### A lib imports no app code

A lib never imports from `src/`. A lib that needs a setting reads its own env vars (`libs/redis`, `libs/s3`) or takes it from the app through a `forRootAsync` factory (`libs/email`).

### Checking the rules

```bash
pnpm lint:boundaries
```

dependency-cruiser (`.dependency-cruiser.cjs`) cruises `src`, `libs` and `test`, type-only imports included, and fails on any import into a lib's subfolder from outside that lib, on any import from a lib into `src/`, and on any import cycle. PR checks run it after typecheck. Privacy is decided by folder depth, so adding a lib or a subfolder needs no config change.
