import { INestApplication, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Note, SaveNoteDto } from '../notes/note.entity';
import type { NotesWriter } from '../notes/notes.tokens';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const notesServiceStub: NotesWriter = {
  saveNote(_userId: string, _input: SaveNoteDto): Promise<Note | null> {
    return Promise.resolve(null);
  },
};

const execFileAsync = promisify(execFile);
const requireFromDist = createRequire(
  join(process.cwd(), 'dist/src/scripts/generateOpenApi.js'),
);

async function buildCompiledSwaggerMetadata(): Promise<void> {
  await execFileAsync('pnpm', ['exec', 'nest', 'build'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10,
  });
}

/**
 * Loads a named export from the *compiled* dist output rather than via a
 * static ts-node import. Nest's DI matches provider tokens by reference, and
 * a controller loaded from dist carries `design:paramtypes`/`@Inject` tokens
 * pointing at the dist copies of its dependencies — a separately
 * ts-node-compiled copy of the "same" class would be a different reference
 * and would fail to resolve.
 */
function loadDistExport<T>(distRelativePath: string, exportName: string): T {
  return (requireFromDist(distRelativePath) as Record<string, unknown>)[
    exportName
  ] as T;
}

async function createOpenApiApp(): Promise<INestApplication> {
  const NotesController = loadDistExport<Type<unknown>>(
    '../notes/notes.controller.js',
    'NotesController',
  );
  const NOTES_SERVICE = loadDistExport<symbol>(
    '../notes/notes.tokens.js',
    'NOTES_SERVICE',
  );
  const AppController = loadDistExport<Type<unknown>>(
    '../app.controller.js',
    'AppController',
  );
  const ArticlesController = loadDistExport<Type<unknown>>(
    '../articles/articles.controller.js',
    'ArticlesController',
  );
  const ExternalArticlesController = loadDistExport<Type<unknown>>(
    '../articles/external-articles.controller.js',
    'ExternalArticlesController',
  );
  const AuthController = loadDistExport<Type<unknown>>(
    '../auth/auth.controller.js',
    'AuthController',
  );
  const BookmarksController = loadDistExport<Type<unknown>>(
    '../bookmarks/bookmarks.controller.js',
    'BookmarksController',
  );
  const BriefingsController = loadDistExport<Type<unknown>>(
    '../briefings/briefings.controller.js',
    'BriefingsController',
  );
  const FeedsController = loadDistExport<Type<unknown>>(
    '../feeds/feeds.controller.js',
    'FeedsController',
  );
  const ProfilesController = loadDistExport<Type<unknown>>(
    '../profiles/profiles.controller.js',
    'ProfilesController',
  );
  const UsersController = loadDistExport<Type<unknown>>(
    '../users/users.controller.js',
    'UsersController',
  );
  const YoutubeChannelsController = loadDistExport<Type<unknown>>(
    '../youtube-channels/youtube-channels.controller.js',
    'YoutubeChannelsController',
  );
  const YoutubeTranscriptionsController = loadDistExport<Type<unknown>>(
    '../youtube-transcriptions/youtube-transcriptions.controller.js',
    'YoutubeTranscriptionsController',
  );
  const CategoriesController = loadDistExport<Type<unknown>>(
    '../categories/categories.controller.js',
    'CategoriesController',
  );
  const AudioController = loadDistExport<Type<unknown>>(
    '../audio-files/audio-files.controller.js',
    'AudioController',
  );

  const ArticlesService = loadDistExport<Type<unknown>>(
    '../articles/articles.service.js',
    'ArticlesService',
  );
  const ListArticlesQuery = loadDistExport<Type<unknown>>(
    '../articles/queries/list-articles.query.js',
    'ListArticlesQuery',
  );
  const ListArticlesLeanQuery = loadDistExport<Type<unknown>>(
    '../articles/queries/list-articles-lean.query.js',
    'ListArticlesLeanQuery',
  );
  const GetArticleByIdQuery = loadDistExport<Type<unknown>>(
    '../articles/queries/get-article-by-id.query.js',
    'GetArticleByIdQuery',
  );
  const ScraperService = loadDistExport<Type<unknown>>(
    '../scraper/scraper.service.js',
    'ScraperService',
  );
  const GenerateArticleAudioCommand = loadDistExport<Type<unknown>>(
    '../articles/commands/generate-article-audio.command.js',
    'GenerateArticleAudioCommand',
  );
  const TelegramSubmissionService = loadDistExport<Type<unknown>>(
    '../articles/services/telegram-submission.service.js',
    'TelegramSubmissionService',
  );
  const ConfigService = loadDistExport<Type<unknown>>(
    '../config/config.service.js',
    'ConfigService',
  );
  const BookmarksService = loadDistExport<Type<unknown>>(
    '../bookmarks/bookmarks.service.js',
    'BookmarksService',
  );
  const NotesReadService = loadDistExport<Type<unknown>>(
    '../notes/notes-read.service.js',
    'NotesReadService',
  );
  const BriefingsService = loadDistExport<Type<unknown>>(
    '../briefings/briefings.service.js',
    'BriefingsService',
  );
  const ListBriefingsQuery = loadDistExport<Type<unknown>>(
    '../briefings/queries/list-briefings.query.js',
    'ListBriefingsQuery',
  );
  const GenerateBriefUseCase = loadDistExport<Type<unknown>>(
    '../briefings/usecases/generate-brief.usecase.js',
    'GenerateBriefUseCase',
  );
  const GenerateCustomBriefUseCase = loadDistExport<Type<unknown>>(
    '../briefings/usecases/generate-custom-brief.usecase.js',
    'GenerateCustomBriefUseCase',
  );
  const GetArticlesFeedQuery = loadDistExport<Type<unknown>>(
    '../feeds/queries/get-articles-feed.query.js',
    'GetArticlesFeedQuery',
  );
  const GetYoutubeFeedQuery = loadDistExport<Type<unknown>>(
    '../feeds/queries/get-youtube-feed.query.js',
    'GetYoutubeFeedQuery',
  );
  const ProfilesService = loadDistExport<Type<unknown>>(
    '../profiles/profiles.service.js',
    'ProfilesService',
  );
  const UsersService = loadDistExport<Type<unknown>>(
    '../users/users.service.js',
    'UsersService',
  );
  const GetYoutubeChannelsQuery = loadDistExport<Type<unknown>>(
    '../youtube-channels/queries/get-youtube-channels.query.js',
    'GetYoutubeChannelsQuery',
  );
  const UpdateChannelEnabledCommand = loadDistExport<Type<unknown>>(
    '../youtube-channels/commands/update-channel-enabled.command.js',
    'UpdateChannelEnabledCommand',
  );
  const CreateYoutubeChannelCommand = loadDistExport<Type<unknown>>(
    '../youtube-channels/commands/create-youtube-channel.command.js',
    'CreateYoutubeChannelCommand',
  );
  const AssignChannelCategoriesCommand = loadDistExport<Type<unknown>>(
    '../youtube-channels/commands/assign-channel-categories.command.js',
    'AssignChannelCategoriesCommand',
  );
  const ListAllYoutubeTranscriptionsQuery = loadDistExport<Type<unknown>>(
    '../youtube-transcriptions/queries/list-all-youtube-transcriptions.query.js',
    'ListAllYoutubeTranscriptionsQuery',
  );
  const GetYoutubeTranscriptionByIdQuery = loadDistExport<Type<unknown>>(
    '../youtube-transcriptions/queries/get-youtube-transcription-by-id.query.js',
    'GetYoutubeTranscriptionByIdQuery',
  );
  const DeleteYoutubeTranscriptionCommand = loadDistExport<Type<unknown>>(
    '../youtube-transcriptions/commands/delete-youtube-transcription.command.js',
    'DeleteYoutubeTranscriptionCommand',
  );
  const EnqueueYoutubeTranscriptionsCommand = loadDistExport<Type<unknown>>(
    '../youtube-transcriptions/commands/enqueue-youtube-transcriptions.command.js',
    'EnqueueYoutubeTranscriptionsCommand',
  );
  const AudioFilesService = loadDistExport<Type<unknown>>(
    '../audio-files/audio-files.service.js',
    'AudioFilesService',
  );
  const ListAudioLibraryQuery = loadDistExport<Type<unknown>>(
    '../audio-files/queries/list-audio-library.query.js',
    'ListAudioLibraryQuery',
  );
  const ListCategoriesQuery = loadDistExport<Type<unknown>>(
    '../categories/queries/list-categories.query.js',
    'ListCategoriesQuery',
  );
  const CreateCategoryCommand = loadDistExport<Type<unknown>>(
    '../categories/commands/create-category.command.js',
    'CreateCategoryCommand',
  );
  const RenameCategoryCommand = loadDistExport<Type<unknown>>(
    '../categories/commands/rename-category.command.js',
    'RenameCategoryCommand',
  );
  const DeleteCategoryCommand = loadDistExport<Type<unknown>>(
    '../categories/commands/delete-category.command.js',
    'DeleteCategoryCommand',
  );

  const QueueService = loadDistExport<Type<unknown>>(
    '../../libs/queue/queue.service.js',
    'QueueService',
  );
  const S3Service = loadDistExport<Type<unknown>>(
    '../../libs/s3/s3.service.js',
    'S3Service',
  );
  const AudioJobService = loadDistExport<Type<unknown>>(
    '../../libs/audio/services/audio-job.service.js',
    'AudioJobService',
  );
  const AuthService = loadDistExport<Type<unknown>>(
    '../../libs/auth/auth.service.js',
    'AuthService',
  );
  const JwtAuthGuard = loadDistExport<Type<unknown>>(
    '../../libs/auth/guards/jwt-auth.guard.js',
    'JwtAuthGuard',
  );
  const RateLimitGuard = loadDistExport<Type<unknown>>(
    '../../libs/auth/rate-limit/rate-limit.guard.js',
    'RateLimitGuard',
  );
  const ExternalTokenGuard = loadDistExport<Type<unknown>>(
    '../articles/guards/external-token.guard.js',
    'ExternalTokenGuard',
  );

  const moduleRef = await Test.createTestingModule({
    controllers: [
      AppController,
      ArticlesController,
      ExternalArticlesController,
      AuthController,
      BookmarksController,
      BriefingsController,
      FeedsController,
      NotesController,
      ProfilesController,
      UsersController,
      YoutubeChannelsController,
      YoutubeTranscriptionsController,
      CategoriesController,
      AudioController,
    ],
    providers: [
      { provide: NOTES_SERVICE, useValue: notesServiceStub },
      { provide: ArticlesService, useValue: {} },
      { provide: ListArticlesQuery, useValue: {} },
    { provide: ListArticlesLeanQuery, useValue: {} },
      { provide: GetArticleByIdQuery, useValue: {} },
      { provide: ScraperService, useValue: {} },
      { provide: GenerateArticleAudioCommand, useValue: {} },
      { provide: TelegramSubmissionService, useValue: {} },
      { provide: ConfigService, useValue: {} },
      { provide: BookmarksService, useValue: {} },
      { provide: NotesReadService, useValue: {} },
      { provide: BriefingsService, useValue: {} },
      { provide: ListBriefingsQuery, useValue: {} },
      { provide: GenerateBriefUseCase, useValue: {} },
      { provide: GenerateCustomBriefUseCase, useValue: {} },
      { provide: GetArticlesFeedQuery, useValue: {} },
      { provide: GetYoutubeFeedQuery, useValue: {} },
      { provide: ProfilesService, useValue: {} },
      { provide: UsersService, useValue: {} },
      { provide: GetYoutubeChannelsQuery, useValue: {} },
      { provide: UpdateChannelEnabledCommand, useValue: {} },
      { provide: CreateYoutubeChannelCommand, useValue: {} },
      { provide: AssignChannelCategoriesCommand, useValue: {} },
      { provide: ListAllYoutubeTranscriptionsQuery, useValue: {} },
      { provide: GetYoutubeTranscriptionByIdQuery, useValue: {} },
      { provide: DeleteYoutubeTranscriptionCommand, useValue: {} },
      { provide: EnqueueYoutubeTranscriptionsCommand, useValue: {} },
      { provide: AudioFilesService, useValue: {} },
      { provide: ListAudioLibraryQuery, useValue: {} },
      { provide: ListCategoriesQuery, useValue: {} },
      { provide: CreateCategoryCommand, useValue: {} },
      { provide: RenameCategoryCommand, useValue: {} },
      { provide: DeleteCategoryCommand, useValue: {} },
      { provide: QueueService, useValue: {} },
      { provide: S3Service, useValue: {} },
      { provide: AudioJobService, useValue: {} },
      { provide: AuthService, useValue: {} },
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RateLimitGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(ExternalTokenGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function sortJsonKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<{ [key: string]: JsonValue }>((sorted, key) => {
        sorted[key] = sortJsonKeys(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

async function main(): Promise<void> {
  await buildCompiledSwaggerMetadata();

  const app = await createOpenApiApp();

  try {
    const config = new DocumentBuilder()
      .setTitle('Meridiano API')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const stableDocument = sortJsonKeys(document as unknown as JsonValue);
    const outputPath = join(process.cwd(), 'openapi.json');

    await writeFile(outputPath, `${JSON.stringify(stableDocument, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
