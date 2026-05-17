import { IS_PUBLIC_KEY } from '@libs/auth';
import { ValidationPipe } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { SaveNoteDto } from './note.entity';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

describe('NotesController', () => {
  const mockNotesService = mock<NotesService>();
  const controller = new NotesController(mockNotesService);
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not have @Public() on saveNote endpoint', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      NotesController.prototype,
      'saveNote',
    );
    expect(isPublic).toBeUndefined();
  });

  it('derives note ownership from the authenticated request user', async () => {
    mockNotesService.saveNote.mockResolvedValue({
      id: 'note-1',
      user_id: '11111111-1111-1111-1111-111111111111',
      source_type: 'article',
      source_id: '22222222-2222-2222-2222-222222222222',
      content: 'Owner note',
      created_at: new Date('2026-05-17T12:00:00.000Z'),
      updated_at: new Date('2026-05-17T12:00:00.000Z'),
    });

    const result = await controller.saveNote(
      {
        user: {
          id: '11111111-1111-1111-1111-111111111111',
        },
      },
      {
        source_type: 'article',
        source_id: '22222222-2222-2222-2222-222222222222',
        content: 'Owner note',
      },
    );

    expect(mockNotesService.saveNote).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      {
        source_type: 'article',
        source_id: '22222222-2222-2222-2222-222222222222',
        content: 'Owner note',
      },
    );
    expect(result).toEqual({
      note: {
        id: 'note-1',
        content: 'Owner note',
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        updated_at: new Date('2026-05-17T12:00:00.000Z'),
      },
    });
  });

  it('rejects client-supplied ownership fields at validation time', async () => {
    await expect(
      validationPipe.transform(
        {
          source_type: 'article',
          source_id: '22222222-2222-2222-2222-222222222222',
          content: 'Owner note',
          user_id: 'malicious-user-id',
        },
        {
          type: 'body',
          metatype: SaveNoteDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'property user_id should not exist',
        ]),
      },
    });
  });

  it('rejects unsupported source types', async () => {
    await expect(
      validationPipe.transform(
        {
          source_type: 'youtube_transcription',
          source_id: '22222222-2222-2222-2222-222222222222',
          content: 'Owner note',
        },
        {
          type: 'body',
          metatype: SaveNoteDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'source_type must be one of: article, transcription',
        ]),
      },
    });
  });

  it('rejects malformed source identifiers', async () => {
    await expect(
      validationPipe.transform(
        {
          source_type: 'article',
          source_id: 'not-a-uuid',
          content: 'Owner note',
        },
        {
          type: 'body',
          metatype: SaveNoteDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining(['source_id must be a valid UUID']),
      },
    });
  });

  it('rejects missing content', async () => {
    await expect(
      validationPipe.transform(
        {
          source_type: 'article',
          source_id: '22222222-2222-2222-2222-222222222222',
        },
        {
          type: 'body',
          metatype: SaveNoteDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining(['content is required']),
      },
    });
  });

  it('rejects overlong content', async () => {
    await expect(
      validationPipe.transform(
        {
          source_type: 'article',
          source_id: '22222222-2222-2222-2222-222222222222',
          content: 'a'.repeat(5001),
        },
        {
          type: 'body',
          metatype: SaveNoteDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'content must not exceed 5000 characters',
        ]),
      },
    });
  });
});
