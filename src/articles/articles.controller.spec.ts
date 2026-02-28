import { IS_PUBLIC_KEY } from '@libs/auth';
import { ArticlesController } from './articles.controller';

describe('ArticlesController', () => {
  it('should not have @Public() on generateAudio endpoint', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      ArticlesController.prototype,
      'generateAudio',
    );
    expect(isPublic).toBeUndefined();
  });

  it('should not have @Public() on getArticle endpoint (playback access)', () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      ArticlesController.prototype,
      'getArticle',
    );
    expect(isPublic).toBeUndefined();
  });
});
