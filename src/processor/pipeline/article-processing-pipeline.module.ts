import { EmailModule } from '@libs/email';
import { Module } from '@nestjs/common';
import { AiAdapter } from '../../ai/adapters/ai-adapter.interface';
import { AiModule } from '../../ai/ai.module';
import { AiService } from '../../ai/ai.service';
import { ArticlesModule } from '../../articles/articles.module';
import { ConfigModule } from '../../config/config.module';
import { ProfilesModule } from '../../profiles/profiles.module';
import { AI_ADAPTER } from './ai-adapter.token';
import { ArticleProcessingPipelineService } from './article-processing-pipeline.service';
import { EmailProcessingNotifier } from './email-processing-notifier';
import { PROCESSING_NOTIFIER } from './processing-notifier';
import { RealSleeper, SLEEPER } from './sleeper';

/**
 * Binds the pipeline's seams to production implementations. AI_ADAPTER wraps
 * `AiService` (retaining provider selection, chunking, and retry policy) behind
 * the {@link AiAdapter} interface so the pipeline never depends on the concrete
 * service. `chat` delegates to `callChatOrThrow`, so the underlying provider
 * error (including `finish_reason`) propagates into the pipeline's typed step
 * failure verbatim rather than being collapsed to a generic message; `embed`
 * still throws on a null result so failures reach the pipeline as step failures.
 */
@Module({
  imports: [
    AiModule,
    ArticlesModule,
    ConfigModule,
    ProfilesModule,
    EmailModule.forRoot(),
  ],
  providers: [
    ArticleProcessingPipelineService,
    { provide: SLEEPER, useClass: RealSleeper },
    { provide: PROCESSING_NOTIFIER, useClass: EmailProcessingNotifier },
    {
      provide: AI_ADAPTER,
      useFactory: (ai: AiService): AiAdapter => ({
        chat: (prompt, systemPrompt, model) =>
          ai.callChatOrThrow(prompt, model, systemPrompt),
        async embed(text) {
          const result = await ai.getEmbedding(text);
          if (result === null) {
            throw new Error('AI embedding returned no content');
          }
          return result;
        },
        generateAudio: (text, voice) => ai.generateAudio(text, voice),
      }),
      inject: [AiService],
    },
  ],
  exports: [ArticleProcessingPipelineService],
})
export class ArticleProcessingPipelineModule {}
