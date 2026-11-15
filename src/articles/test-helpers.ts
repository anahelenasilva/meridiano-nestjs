import { DatabaseService } from '@libs/database';
import { mock } from 'jest-mock-extended';
import { AudioFilesCleanupService } from '../audio-files/audio-files-cleanup.service';
import { NotesCleanupService } from '../notes/notes-cleanup.service';
import { DBArticle } from './article.entity';
import { ArticlesService } from './articles.service';

export function makeArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  return {
    id: 'article-1',
    url: 'https://example.com/a',
    title: 'An Article',
    published_date: new Date('2026-01-01'),
    feed_source: 'Example Feed',
    raw_content: 'raw content body',
    feed_profile: 'general',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// Shared setup for the articles.service*.spec.ts files. Each file creates the
// mocks once inside describe('ArticlesService'), builds a fresh service in
// beforeEach with buildArticlesService(mocks), and passes
// resetArticlesServiceMocks to afterEach.
export function createArticlesServiceMocks() {
  return {
    mockDatabaseService: mock<DatabaseService>(),
    mockNotesCleanupService: mock<NotesCleanupService>(),
    mockAudioFilesCleanupService: mock<AudioFilesCleanupService>(),
    mockDb: {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
    },
  };
}

export function buildArticlesService({
  mockDatabaseService,
  mockNotesCleanupService,
  mockAudioFilesCleanupService,
  mockDb,
}: ReturnType<typeof createArticlesServiceMocks>): ArticlesService {
  mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
  mockNotesCleanupService.purgeNotesForSource.mockResolvedValue(0);
  mockAudioFilesCleanupService.purgeAudioForSource.mockResolvedValue();
  return new ArticlesService(
    mockDatabaseService,
    mockNotesCleanupService,
    mockAudioFilesCleanupService,
  );
}

export function resetArticlesServiceMocks(): void {
  // resetAllMocks, not clearAllMocks: an unconsumed mockImplementationOnce
  // from a failing test would otherwise leak into the next one.
  jest.resetAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
}
