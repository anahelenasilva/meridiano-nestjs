---
name: Refactor Usecases to Domain Modules - VALIDATED
overview: "Move all usecases from the centralized `src/usecases` module into their respective domain modules: briefing usecases to `src/briefings/usecases`, youtube-transcriptions usecases to `src/youtube-transcriptions/usecases`, and audio usecases to `src/audio-files/usecases`. Update all imports and module configurations, then remove the UsecasesModule."
todos:
  - id: create-directories
    content: "Create usecases directories: src/briefings/usecases/, src/briefings/usecases/dto/, src/youtube-transcriptions/usecases/, src/youtube-transcriptions/usecases/dto/, src/audio-files/usecases/, src/audio-files/usecases/dto/"
    status: pending
  - id: move-briefing-usecases
    content: Move all briefing usecase files and DTOs to src/briefings/usecases/ and update internal imports
    status: pending
  - id: move-youtube-usecases
    content: Move all youtube-transcription usecase files and DTOs to src/youtube-transcriptions/usecases/ and update internal imports
    status: pending
  - id: move-audio-usecases
    content: Move audio usecase file and DTO to src/audio-files/usecases/ and update internal imports
    status: pending
  - id: update-briefings-module
    content: Update BriefingsModule to include all briefing usecases as providers/exports and add required module imports (use forwardRef(() => BriefingModule) to handle circular dependency)
    status: pending
  - id: update-youtube-module
    content: Update YoutubeTranscriptionsModule to include youtube-transcription usecases and remove UsecasesModule dependency
    status: pending
  - id: update-audio-module
    content: Update AudioFilesModule to include GenerateAudioUseCase and add required module imports
    status: pending
  - id: update-scripts
    content: Update all script files (runBriefing.ts, runProcessTranscriptions.ts, runYoutubeTranscripts.ts, runListTranscriptions.ts) with new import paths
    status: pending
  - id: update-services
    content: Update processor.service.ts and youtube-transcription.processor.ts with new import paths
    status: pending
  - id: update-modules
    content: Remove UsecasesModule from app.module.ts, processor.module.ts, and youtube-transcriptions.module.ts
    status: pending
  - id: cleanup
    content: Delete src/usecases/ directory and usecases.module.ts
    status: pending
isProject: false
---

# Refactor Usecases to Domain Modules - VALIDATED PLAN

## Overview

Move usecases from the centralized `src/usecases` directory into their respective domain modules, following the domain-driven design pattern where usecases live alongside their domain logic.

## Validation Summary

This plan has been validated for:
- **Security vulnerabilities**: No issues identified
- **Circular dependencies**: Identified and solutions documented
- **Architectural fit/scalability**: Validated - improves DDD alignment
- **Maintainability long-term**: Validated - improves cohesion and reduces coupling

## File Structure Changes

### 1. Briefing Usecases → `src/briefings/usecases/`

Move from `src/usecases/briefing/`:

- `categorize-articles.usecase.ts`
- `generate-brief.usecase.ts`
- `generate-simple-brief.usecase.ts`
- `process-articles.usecase.ts`
- `rate-articles.usecase.ts`
- `run-briefing.usecase.ts`
- `scrape-articles.usecase.ts`

Move DTOs from `src/usecases/briefing/dto/`:

- `categorize-articles.dto.ts`
- `generate-brief.dto.ts`
- `process-articles.dto.ts`
- `rate-articles.dto.ts`
- `run-briefing.dto.ts`
- `scrape-articles.dto.ts`

### 2. YouTube Transcription Usecases → `src/youtube-transcriptions/usecases/`

Move from `src/usecases/youtube-transcriptions/`:

- `extract-youtube-transcripts.usecase.ts`
- `list-transcriptions.usecase.ts`
- `process-transcription-files.usecase.ts`

Move DTOs from `src/usecases/youtube-transcriptions/dto/`:

- `extract-youtube-transcripts.dto.ts`
- `list-transcriptions.dto.ts`
- `process-transcription-files.dto.ts`

### 3. Audio Usecases → `src/audio-files/usecases/`

Move from `src/usecases/audio/`:

- `generate-audio.usecase.ts`

Move DTO from `src/usecases/audio/dto/`:

- `generate-audio.dto.ts`

## Module Updates

### BriefingsModule (`src/briefings/briefings.module.ts`)

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@libs/database';
import { ArticlesService } from '../articles/articles.service';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { BriefingModule } from '../briefing/briefing.module';
import { ProcessorModule } from '../processor/processor.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScraperModule } from '../scraper/scraper.module';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

// Usecases
import { CategorizeArticlesUseCase } from './usecases/categorize-articles.usecase';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from './usecases/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from './usecases/process-articles.usecase';
import { RateArticlesUseCase } from './usecases/rate-articles.usecase';
import { RunBriefingUseCase } from './usecases/run-briefing.usecase';
import { ScrapeArticlesUseCase } from './usecases/scrape-articles.usecase';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => BriefingModule), // REQUIRED: breaks circular dependency
    ProcessorModule,
    ProfilesModule,
    ScraperModule,
    ConfigModule,
    AiModule,
  ],
  providers: [
    BriefingsService,
    ArticlesService,
    ListBriefingsQuery,
    // Briefing usecases
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
  controllers: [BriefingsController],
  exports: [
    BriefingsService,
    // Export usecases for external use
    CategorizeArticlesUseCase,
    GenerateBriefUseCase,
    GenerateSimpleBriefUseCase,
    ProcessArticlesUseCase,
    RateArticlesUseCase,
    RunBriefingUseCase,
    ScrapeArticlesUseCase,
  ],
})
export class BriefingsModule { }
```

### YoutubeTranscriptionsModule (`src/youtube-transcriptions/youtube-transcriptions.module.ts`)

```typescript
import { DatabaseModule } from '@libs/database';
import { QueueModule } from '@libs/queue';
import { RedisModule } from '@libs/redis';
import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { AudioFilesModule } from '../audio-files/audio-files.module'; // ADDED
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { YoutubeChannelsModule } from '../youtube-channels/youtube-channels.module';
import { CreateYoutubeTranscriptionCommand } from './commands/create-youtube-transcription.command';
import { DeleteYoutubeTranscriptionCommand } from './commands/delete-youtube-transcription.command';
import { YoutubeTranscriptionProcessor } from './processors/youtube-transcription.processor';
import { GetYoutubeTranscriptionByIdQuery } from './queries/get-youtube-transcription-by-id.query';
import { ListAllYoutubeTranscriptionsQuery } from './queries/list-all-youtube-transcriptions.query';
import { ListYoutubeTranscriptionsQuery } from './queries/list-youtube-transcriptions.query';
import { StorageService } from './services/storage.service';
import { TranscriptService } from './services/transcript.service';
import { YoutubeTranscriptionsAlternativeService } from './services/youtube-transcriptions-alternative.service';
import { YoutubeTranscriptionsService } from './services/youtube-transcriptions.service';
import { YouTubeService } from './services/youtube.service';
import { YoutubeTranscriptionsController } from './youtube-transcriptions.controller';

// Usecases
import { ExtractYoutubeTranscriptsUseCase } from './usecases/extract-youtube-transcripts.usecase';
import { ListTranscriptionsUseCase } from './usecases/list-transcriptions.usecase';
import { ProcessTranscriptionFilesUseCase } from './usecases/process-transcription-files.usecase';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    ConfigModule,
    YoutubeChannelsModule,
    RedisModule,
    AudioFilesModule, // ADDED: for GenerateAudioUseCase
    forwardRef(() => QueueModule),
    // REMOVED: forwardRef(() => UsecasesModule),
  ],
  providers: [
    YoutubeTranscriptionsService,
    YouTubeService,
    TranscriptService,
    YoutubeTranscriptionsAlternativeService,
    StorageService,
    AiService,
    ConfigService,
    ListYoutubeTranscriptionsQuery,
    ListAllYoutubeTranscriptionsQuery,
    GetYoutubeTranscriptionByIdQuery,
    DeleteYoutubeTranscriptionCommand,
    CreateYoutubeTranscriptionCommand,
    YoutubeTranscriptionProcessor,
    // YouTube transcription usecases
    ExtractYoutubeTranscriptsUseCase,
    ListTranscriptionsUseCase,
    ProcessTranscriptionFilesUseCase,
  ],
  exports: [
    YoutubeTranscriptionsService,
    // Export usecases for external use
    ExtractYoutubeTranscriptsUseCase,
    ListTranscriptionsUseCase,
    ProcessTranscriptionFilesUseCase,
  ],
  controllers: [YoutubeTranscriptionsController],
})
export class YoutubeTranscriptionsModule { }
```

### AudioFilesModule (`src/audio-files/audio-files.module.ts`)

```typescript
import { DatabaseModule } from '@libs/database';
import { S3Module } from '@libs/s3';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { AudioFilesService } from './audio-files.service';
import { GenerateAudioUseCase } from './usecases/generate-audio.usecase';

@Module({
  imports: [
    DatabaseModule,
    S3Module,
    AiModule,      // ADDED: for AiService
    ConfigModule,  // ADDED: for ConfigService
  ],
  providers: [
    AudioFilesService,
    GenerateAudioUseCase,  // ADDED
  ],
  exports: [
    AudioFilesService,
    GenerateAudioUseCase,  // ADDED
  ],
})
export class AudioFilesModule { }
```

## Import Updates

### Scripts

Update `src/scripts/runBriefing.ts`:
```typescript
// BEFORE:
import { CategorizeArticlesUseCase } from '../usecases/briefing/categorize-articles.usecase';
import { GenerateBriefUseCase } from '../usecases/briefing/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from '../usecases/briefing/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from '../usecases/briefing/process-articles.usecase';
import { RateArticlesUseCase } from '../usecases/briefing/rate-articles.usecase';
import { RunBriefingUseCase } from '../usecases/briefing/run-briefing.usecase';
import { ScrapeArticlesUseCase } from '../usecases/briefing/scrape-articles.usecase';

// AFTER:
import { CategorizeArticlesUseCase } from '../briefings/usecases/categorize-articles.usecase';
import { GenerateBriefUseCase } from '../briefings/usecases/generate-brief.usecase';
import { GenerateSimpleBriefUseCase } from '../briefings/usecases/generate-simple-brief.usecase';
import { ProcessArticlesUseCase } from '../briefings/usecases/process-articles.usecase';
import { RateArticlesUseCase } from '../briefings/usecases/rate-articles.usecase';
import { RunBriefingUseCase } from '../briefings/usecases/run-briefing.usecase';
import { ScrapeArticlesUseCase } from '../briefings/usecases/scrape-articles.usecase';
```

Update `src/scripts/runProcessTranscriptions.ts`:
```typescript
// BEFORE:
import { ProcessTranscriptionFilesUseCase } from '../usecases/youtube-transcriptions/process-transcription-files.usecase';

// AFTER:
import { ProcessTranscriptionFilesUseCase } from '../youtube-transcriptions/usecases/process-transcription-files.usecase';
```

Update `src/scripts/runYoutubeTranscripts.ts`:
```typescript
// BEFORE:
import { ExtractYoutubeTranscriptsUseCase } from '../usecases/youtube-transcriptions/extract-youtube-transcripts.usecase';

// AFTER:
import { ExtractYoutubeTranscriptsUseCase } from '../youtube-transcriptions/usecases/extract-youtube-transcripts.usecase';
```

Update `src/scripts/runListTranscriptions.ts`:
```typescript
// BEFORE:
import { ListTranscriptionsUseCase } from '../usecases/youtube-transcriptions/list-transcriptions.usecase';

// AFTER:
import { ListTranscriptionsUseCase } from '../youtube-transcriptions/usecases/list-transcriptions.usecase';
```

### Services

Update `src/processor/processor.service.ts`:
```typescript
// BEFORE:
import { GenerateAudioUseCase } from '../usecases/audio/generate-audio.usecase';

// AFTER:
import { GenerateAudioUseCase } from '../audio-files/usecases/generate-audio.usecase';
```

Update `src/youtube-transcriptions/processors/youtube-transcription.processor.ts`:
```typescript
// BEFORE:
import { GenerateAudioUseCase } from '../../usecases/audio/generate-audio.usecase';

// AFTER:
import { GenerateAudioUseCase } from '../../audio-files/usecases/generate-audio.usecase';
```

### Modules

Update `src/app.module.ts`:
```typescript
// BEFORE:
import { UsecasesModule } from './usecases/usecases.module';

@Module({
  imports: [
    // ... other imports
    UsecasesModule,  // REMOVE THIS
    // ... other imports
  ],
})

// AFTER:
// Remove UsecasesModule import entirely
```

Update `src/processor/processor.module.ts`:
```typescript
import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { AudioFilesModule } from '../audio-files/audio-files.module'; // ADDED
import { ConfigModule } from '../config/config.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    forwardRef(() => ArticlesModule),
    AiModule,
    ConfigModule,
    ProfilesModule,
    AudioFilesModule,  // ADDED: replaces UsecasesModule for GenerateAudioUseCase
    // REMOVED: forwardRef(() => UsecasesModule),
  ],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule { }
```

### Internal Usecase Imports

Update `src/briefings/usecases/run-briefing.usecase.ts`:
```typescript
// All internal imports become relative to the same directory:
import { CategorizeArticlesUseCase } from './categorize-articles.usecase';
import { GenerateBriefUseCase } from './generate-brief.usecase';
import { ProcessArticlesUseCase } from './process-articles.usecase';
import { RateArticlesUseCase } from './rate-articles.usecase';
import { ScrapeArticlesUseCase } from './scrape-articles.usecase';
```

All usecase files: Update DTO imports to use `./dto/`:
```typescript
import { SomeDto } from './dto/some.dto';
```

## Cleanup

- Delete `src/usecases/usecases.module.ts`
- Delete entire `src/usecases/` directory after all files are moved

## Critical Circular Dependencies Analysis

### Issue 1: BriefingModule ↔ BriefingsModule ↔ UsecasesModule (Complex Circular Chain)

**Current State:**
```
BriefingModule imports: ArticlesModule, BriefingsModule, AiModule, ConfigModule, ProfilesModule
BriefingsModule imports: DatabaseModule
UsecasesModule imports: BriefingModule, forwardRef(() => ProcessorModule), forwardRef(() => YoutubeTranscriptionsModule), ...
ProcessorModule imports: forwardRef(() => ArticlesModule), forwardRef(() => UsecasesModule)
```

**Problem:**
- `BriefingModule` imports `BriefingsModule` (line 4 of briefing.module.ts)
- `GenerateBriefUseCase` and `GenerateSimpleBriefUseCase` depend on `BriefingService` from `BriefingModule`
- When usecases move to `BriefingsModule`, `BriefingsModule` will need `BriefingModule`
- This creates: `BriefingModule` → `BriefingsModule` → `BriefingModule` circular dependency

**Solution:**
Use `forwardRef(() => BriefingModule)` in `BriefingsModule` imports:

```typescript
@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => BriefingModule), // REQUIRED
    ProcessorModule,
    ProfilesModule,
    ScraperModule,
    ConfigModule,
    AiModule,
  ],
  // ...
})
```

**Note:** The existing `BriefingModule` imports `BriefingsModule` directly (not using forwardRef), which currently works because the circular dependency is only triggered during `BriefingsModule` initialization. When we add the reverse dependency, `forwardRef()` becomes mandatory.

### Issue 2: ProcessorModule ↔ UsecasesModule (Will become ProcessorModule ↔ BriefingsModule)

**Current State:**
```
ProcessorModule imports: forwardRef(() => UsecasesModule)
UsecasesModule imports: forwardRef(() => ProcessorModule)
```

**Problem After Refactor:**
- `ProcessorService` uses `GenerateAudioUseCase` from usecases
- `ProcessArticlesUseCase` uses `ProcessorService`
- After refactor: `ProcessorModule` needs `AudioFilesModule` (for GenerateAudioUseCase)
- `BriefingsModule` needs `ProcessorModule` (for ProcessArticlesUseCase)
- No circular dependency here - this is a clean dependency chain

**Solution:**
Remove circular dependency entirely:
- `ProcessorModule` imports `AudioFilesModule` (not BriefingsModule)
- `BriefingsModule` imports `ProcessorModule`
- Result: Linear dependency: `AudioFilesModule` ← `ProcessorModule` ← `BriefingsModule`

### Issue 3: YoutubeTranscriptionsModule ↔ UsecasesModule

**Current State:**
```
YoutubeTranscriptionsModule imports: forwardRef(() => UsecasesModule)
UsecasesModule imports: forwardRef(() => YoutubeTranscriptionsModule)
```

**Problem After Refactor:**
- `YoutubeTranscriptionProcessor` uses `GenerateAudioUseCase`
- After refactor: `YoutubeTranscriptionsModule` needs `AudioFilesModule`
- No circular dependency - clean import

**Solution:**
Replace with direct import:
```typescript
@Module({
  imports: [
    // ... other imports
    AudioFilesModule,  // Replace forwardRef(() => UsecasesModule)
    // ...
  ],
})
```

## Dependency Graph After Refactor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH (AFTER)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  AudioFilesMod  │◄──────────────────────────────────────────┐
│  - GenerateAudio│                                           │
└────────┬────────┘                                           │
         │                                                     │
         │ imports                                             │ uses
         ▼                                                     │
┌─────────────────┐     ┌─────────────────┐                  │
│  ProcessorMod   │◄────│  BriefingsMod   │                  │
│  - ProcessorSvc │     │  - BriefingUCs  │                  │
└────────┬────────┘     └────────┬────────┘                  │
         │                       │                            │
         │ uses                  │ forwardRef                 │
         ▼                       ▼                            │
┌─────────────────┐     ┌─────────────────┐                  │
│  ArticlesMod    │     │  BriefingMod    │                  │
└─────────────────┘     └─────────────────┘                  │
                                                              │
┌─────────────────────────────────────────────────────────────┘
│
│     ┌─────────────────┐
└────►│ YoutubeTransMod │
      │ - TranscriptUCs │
      └─────────────────┘
```

## Security Assessment

### No Security Vulnerabilities Identified

1. **No exposure of sensitive data**: The refactor only moves files, doesn't change data handling
2. **No new injection points**: Dependency injection patterns remain the same
3. **No authentication/authorization changes**: Guards and decorators are unaffected
4. **No API surface changes**: Controllers remain in their original locations

## Architectural Fit & Scalability

### Positive Impacts

1. **Better Domain-Driven Design alignment**: Usecases colocated with domain logic
2. **Improved cohesion**: Related functionality grouped together
3. **Reduced coupling**: Eliminates the "god module" (UsecasesModule) anti-pattern
4. **Clearer boundaries**: Each domain module is self-contained
5. **Easier testing**: Domain modules can be tested in isolation

### Scalability Considerations

1. **Module boundaries are clear**: Adding new usecases follows established pattern
2. **No performance impact**: Same DI container, just better organization
3. **Team scalability**: Multiple developers can work on different domains without conflicts

## Maintainability Long-term

### Benefits

1. **Discoverability**: Developers find usecases in their domain folder
2. **Refactoring safety**: Changes to one domain don't affect others
3. **Consistent pattern**: All domains follow same structure
4. **Reduced cognitive load**: No need to understand entire usecases module

### Risks and Mitigations

| Risk                    | Likelihood | Impact | Mitigation                                    |
| ----------------------- | ---------- | ------ | --------------------------------------------- |
| forwardRef issues       | Medium     | High   | Test thoroughly, verify startup order         |
| Missing exports         | Low        | Medium | Use TypeScript strict mode, check all imports |
| Circular deps re-emerge | Low        | High   | Document dependency rules, code reviews       |

## Implementation Order

1. **Create new directory structures** (`usecases/` and `usecases/dto/` in each domain)
2. **Move files and update internal imports** (usecase → usecase, usecase → DTO)
3. **Update AudioFilesModule** first (no circular dependencies)
4. **Update BriefingsModule** with forwardRef for BriefingModule
5. **Update YoutubeTranscriptionsModule**
6. **Update ProcessorModule** (remove UsecasesModule, add AudioFilesModule)
7. **Update external imports** (scripts, services, processors)
8. **Remove UsecasesModule from AppModule**
9. **Delete old usecases directory**
10. **Verify all imports resolve correctly** (`pnpm build`)
11. **Run tests** to ensure no runtime errors

## Verification Checklist

- [ ] All usecase files moved to correct locations
- [ ] All DTO files moved to correct locations
- [ ] Internal usecase imports updated (relative paths)
- [ ] BriefingsModule includes forwardRef(() => BriefingModule)
- [ ] BriefingsModule exports all usecases
- [ ] AudioFilesModule includes AiModule and ConfigModule
- [ ] AudioFilesModule exports GenerateAudioUseCase
- [ ] YoutubeTranscriptionsModule imports AudioFilesModule
- [ ] YoutubeTranscriptionsModule removes UsecasesModule import
- [ ] ProcessorModule imports AudioFilesModule
- [ ] ProcessorModule removes UsecasesModule import
- [ ] AppModule removes UsecasesModule import
- [ ] All script files updated with new import paths
- [ ] processor.service.ts updated with new import path
- [ ] youtube-transcription.processor.ts updated with new import path
- [ ] TypeScript compilation succeeds
- [ ] Application starts without errors
- [ ] All existing functionality works as expected
