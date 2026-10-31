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
      source: 'external',
      customPrompt: 'Summarise the key argument',
      generateAudio: true,
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

  it('should validate without the optional fields', async () => {
    const dto = plainToInstance(ExternalCreateArticleDto, {
      url: 'https://example.com/article',
      feedProfile: FeedProfile.BUSINESS,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
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
