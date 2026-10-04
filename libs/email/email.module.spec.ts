import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../src/config/config.service';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

describe('EmailModule', () => {
  it('provides EmailService configured from the global ConfigService', async () => {
    const configService = mock<ConfigService>();
    configService.getMailgunConfig.mockReturnValue({
      apiKey: 'test-key',
      domain: 'test-domain.com',
      url: undefined,
    });

    // EmailModule relies on the app's @Global() ConfigModule.
    @Global()
    @Module({
      providers: [{ provide: ConfigService, useValue: configService }],
      exports: [ConfigService],
    })
    class GlobalConfigModule {}

    const testingModule = await Test.createTestingModule({
      imports: [GlobalConfigModule, EmailModule.forRoot()],
    }).compile();

    expect(testingModule.get(EmailService)).toBeInstanceOf(EmailService);
    expect(configService.getMailgunConfig).toHaveBeenCalled();
  });
});
