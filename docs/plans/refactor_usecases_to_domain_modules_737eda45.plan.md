---
name: Refactor Usecases to Domain Modules
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

# Refactor Usecases to Domain Modules

## Overview

Move usecases from the centralized `src/usecases` directory into their respective domain modules, following the domain-driven design pattern where usecases live alongside their domain logic.

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

- Add all briefing usecases as providers
- Export all briefing usecases
- Import required dependencies:
  - `forwardRef(() => BriefingModule)` - **REQUIRED** to break circular dependency (BriefingModule already imports BriefingsModule)
  - ScraperModule
  - ProcessorModule
  - ProfilesModule
  - ConfigModule
  - AiModule

### YoutubeTranscriptionsModule (`src/youtube-transcriptions/youtube-transcriptions.module.ts`)

- Add all youtube-transcription usecases as providers
- Export all youtube-transcription usecases
- Remove `UsecasesModule` import
- Import required dependencies (already present)

### AudioFilesModule (`src/audio-files/audio-files.module.ts`)

- Add `GenerateAudioUseCase` as provider
- Export `GenerateAudioUseCase`
- Import required dependencies (AiModule, ConfigModule, S3Module - already has S3Module)

## Import Updates

### Scripts

- `src/scripts/runBriefing.ts`: Update imports from `../usecases/briefing/` to `../briefings/usecases/`
- `src/scripts/runProcessTranscriptions.ts`: Update import from `../usecases/youtube-transcriptions/` to `../youtube-transcriptions/usecases/`
- `src/scripts/runYoutubeTranscripts.ts`: Update import from `../usecases/youtube-transcriptions/` to `../youtube-transcriptions/usecases/`
- `src/scripts/runListTranscriptions.ts`: Update import from `../usecases/youtube-transcriptions/` to `../youtube-transcriptions/usecases/`

### Services

- `src/processor/processor.service.ts`: Update import from `../usecases/audio/` to `../audio-files/usecases/`
- `src/youtube-transcriptions/processors/youtube-transcription.processor.ts`: Update import from `../../usecases/audio/` to `../../audio-files/usecases/`

### Modules

- `src/app.module.ts`: Remove `UsecasesModule` import and from imports array
- `src/processor/processor.module.ts`: Remove `UsecasesModule` import and from imports array, add `AudioFilesModule` import
- `src/youtube-transcriptions/youtube-transcriptions.module.ts`: Remove `UsecasesModule` import and from imports array, add `AudioFilesModule` import (if not already present) for the processor's GenerateAudioUseCase dependency

### Internal Usecase Imports

- `src/briefings/usecases/run-briefing.usecase.ts`: Update relative imports for other briefing usecases (they'll be in the same directory)
- All usecase files: Update relative imports for DTOs (they'll be in `./dto/`)

## Cleanup

- Delete `src/usecases/usecases.module.ts`
- Delete entire `src/usecases/` directory after all files are moved

## Dependencies to Consider

### BriefingsModule needs:

- ScraperModule (for ScrapeArticlesUseCase)
- ProcessorModule (for ProcessArticlesUseCase)
- ProfilesModule (for all usecases)
- ConfigModule (for RunBriefingUseCase, GenerateBriefUseCase)
- AiModule (for GenerateBriefUseCase, GenerateSimpleBriefUseCase)
- BriefingModule (for GenerateBriefUseCase, GenerateSimpleBriefUseCase)

### AudioFilesModule needs:

- AiModule (for GenerateAudioUseCase)
- ConfigModule (for GenerateAudioUseCase)
- S3Module (already imported)

### YoutubeTranscriptionsModule:

- Already has most dependencies
- Needs to ensure AudioFilesModule is imported (for GenerateAudioUseCase used by processor)

## Circular Dependency Handling

### BriefingModule ↔ BriefingsModule Circular Dependency

**Issue**: `BriefingModule` already imports `BriefingsModule`, and `BriefingsModule` needs to import `BriefingModule` because `GenerateBriefUseCase` and `GenerateSimpleBriefUseCase` use `BriefingService`.

**Solution**: Use `forwardRef()` in `BriefingsModule`:

```typescript
imports: [
  forwardRef(() => BriefingModule),
  // ... other imports
]
```

**Note**: `BriefingModule` currently imports `BriefingsModule` directly (not using `forwardRef`). This works because the circular dependency is only one-way at initialization. However, when `BriefingsModule` imports `BriefingModule`, we must use `forwardRef()` to prevent initialization order issues.

## Implementation Order

1. Create new directory structures (`usecases/` and `usecases/dto/` in each domain)
2. Move files and update internal imports (usecase → usecase, usecase → DTO)
3. Update module files (add providers/exports, update imports)
4. Update external imports (scripts, services, processors)
5. Remove UsecasesModule from AppModule and other modules
6. Delete old usecases directory
7. Verify all imports resolve correctly
