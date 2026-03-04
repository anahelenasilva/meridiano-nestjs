import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ExternalCreateArticleDto } from './external-create-article.dto';
import { FeedProfile } from '../../shared/types/feed';

describe('ExternalCreateArticleDto', () => {
  it('should validate with valid data', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.TECHNOLOGY,
      source: 'telegram',
      metadata: {
        chatId: '123456789',
        messageId: '456',
        username: '@testuser',
        note: 'Great article',
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation with invalid URL', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'not-a-valid-url',
      feedProfile: FeedProfile.TECHNOLOGY,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('url');
  });

  it('should fail validation with empty URL', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: '',
      feedProfile: FeedProfile.TECHNOLOGY,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'url')).toBe(true);
  });

  it('should fail validation with invalid feed profile', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: 'invalid-profile',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('feedProfile');
  });

  it('should fail validation with missing feed profile', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'feedProfile')).toBe(true);
  });

  it('should validate without optional metadata', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.BUSINESS,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with partial metadata', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.POLITICS,
      metadata: {
        chatId: '123456789',
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when metadata has invalid field types', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.POLITICS,
      metadata: {
        chatId: 12345,
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('metadata');
    expect(errors[0].children?.some(e => e.property === 'chatId')).toBe(true);
  });

  it('should fail validation when metadata is not an object', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.TECHNOLOGY,
      metadata: 'invalid',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('metadata');
  });

  it('should accept all valid feed profiles', async () => {
    const validProfiles = Object.values(FeedProfile);

    for (const profile of validProfiles) {
      const dto = plainToInstance(ExternalCreateArticleDto, {
        url: 'https://example.com/article',
        feedProfile: profile,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
