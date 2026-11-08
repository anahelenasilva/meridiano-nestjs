import { API_KEY_ALLOWED_KEY } from '@libs/auth';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { ArticleActionsController } from './article-actions.controller';
import { ArticleActionsService } from './article-actions.service';

describe('ArticleActionsController', () => {
  const mockService = mock<ArticleActionsService>();
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ArticleActionsController],
      providers: [{ provide: ArticleActionsService, useValue: mockService }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    'findPending',
    'create',
    'getByShortId',
    'revise',
    'transition',
  ] as const)('%s is marked @ApiKeyAllowed()', (route) => {
    // SetMetadata stores method metadata on the handler function itself.
    const allowed = Reflect.getMetadata(
      API_KEY_ALLOWED_KEY,
      ArticleActionsController.prototype[route],
    );
    expect(allowed).toBe(true);
  });

  it('GET /api/article-actions/not-hex returns 400', async () => {
    await request(app.getHttpServer())
      .get('/api/article-actions/not-hex')
      .expect(400);

    expect(mockService.getByShortId).not.toHaveBeenCalled();
  });
});
