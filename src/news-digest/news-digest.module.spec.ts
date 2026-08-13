import { Logger } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../config/config.service';
import { NewsDigestModule } from './news-digest.module';

describe('NewsDigestModule.onModuleInit', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeModule(overrides: { prompt?: string }) {
    const mockConfig = mock<ConfigService>();
    mockConfig.getNewsDigestPrompt.mockReturnValue(overrides.prompt ?? 'prompt');
    return new NewsDigestModule(mockConfig);
  }

  it('does not warn when NEWS_DIGEST_PROMPT is set', () => {
    makeModule({}).onModuleInit();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns naming only NEWS_DIGEST_PROMPT when it is missing', () => {
    makeModule({ prompt: '' }).onModuleInit();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain('NEWS_DIGEST_PROMPT');
    expect(message).not.toContain('NEWS_DIGEST_TO_EMAIL');
    expect(message).not.toContain('NEWS_DIGEST_FROM_EMAIL');
  });
});
