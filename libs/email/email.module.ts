import {
  DynamicModule,
  InjectionToken,
  Module,
  Type,
} from '@nestjs/common';
import { EmailService, MAILGUN_CONFIG } from './email.service';
import { MailgunConfig } from './interfaces/mailgun-config.interface';

// Class tokens resolve to their instance type; string and symbol tokens to
// `unknown`, so the factory has to narrow them itself.
type Injected<Tokens extends readonly InjectionToken[]> = {
  [K in keyof Tokens]: Tokens[K] extends Type<infer Instance>
    ? Instance
    : unknown;
};

@Module({})
export class EmailModule {
  /**
   * The app hands over its Mailgun settings so this lib never imports the
   * app's ConfigService:
   *
   *   EmailModule.forRootAsync({
   *     inject: [ConfigService],
   *     useFactory: (config) => config.getMailgunConfig(),
   *   })
   *
   * `inject` tokens must come from a global module. The app's ConfigModule is
   * @Global(), and importing it here risks the require() cycle documented in
   * redis.module.ts.
   */
  static forRootAsync<const Tokens extends readonly InjectionToken[]>(options: {
    inject: Tokens;
    useFactory: (
      ...deps: Injected<Tokens>
    ) => MailgunConfig | Promise<MailgunConfig>;
  }): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: MAILGUN_CONFIG,
          inject: [...options.inject],
          useFactory: options.useFactory,
        },
        EmailService,
      ],
      exports: [EmailService],
    };
  }
}
