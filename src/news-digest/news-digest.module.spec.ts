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

  function makeModule(overrides: {
    prompt?: string;
    to?: string;
    from?: string;
  }) {
    const mockConfig = mock<ConfigService>();
    mockConfig.getNewsDigestPrompt.mockReturnValue(overrides.prompt ?? 'prompt');
    mockConfig.getNewsDigestToEmail.mockReturnValue(overrides.to ?? 'to@example.com');
    mockConfig.getNewsDigestFromEmail.mockReturnValue(overrides.from ?? 'from@example.com');
    return new NewsDigestModule(mockConfig);
  }

  it('does not warn when all three env vars are set', () => {
    makeModule({}).onModuleInit();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns with all three var names when none are set', () => {
    makeModule({ prompt: '', to: '', from: '' }).onModuleInit();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain('NEWS_DIGEST_PROMPT');
    expect(message).toContain('NEWS_DIGEST_TO_EMAIL');
    expect(message).toContain('NEWS_DIGEST_FROM_EMAIL');
  });

  it('warns naming only the missing var when just one is absent', () => {
    makeModule({ to: '' }).onModuleInit();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain('NEWS_DIGEST_TO_EMAIL');
    expect(message).not.toContain('NEWS_DIGEST_PROMPT');
    expect(message).not.toContain('NEWS_DIGEST_FROM_EMAIL');
  });
});
