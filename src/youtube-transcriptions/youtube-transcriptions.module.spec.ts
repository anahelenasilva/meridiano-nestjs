import 'reflect-metadata';
import { QueueModule } from '@libs/queue';
import { QueueService } from '@libs/queue';
import { YoutubeTranscriptionsExtractionService } from './services/youtube-transcriptions-extraction.service';
import { YoutubeTranscriptionsModule } from './youtube-transcriptions.module';

// QueueModule imports only RedisModule and queue.service.ts imports nothing
// from src, so there is no cycle to break here. A forwardRef would hide a real
// one if it ever came back, which is why these pin the plain wiring.
describe('YoutubeTranscriptionsModule queue wiring', () => {
  it('imports QueueModule directly, not behind a forwardRef', () => {
    const imports = Reflect.getMetadata(
      'imports',
      YoutubeTranscriptionsModule,
    ) as unknown[];

    expect(imports).toContain(QueueModule);
  });

  it('injects QueueService by type, with no @Inject override', () => {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      YoutubeTranscriptionsExtractionService,
    ) as unknown[];

    expect(paramTypes).toContain(QueueService);
    expect(
      Reflect.getMetadata(
        'self:paramtypes',
        YoutubeTranscriptionsExtractionService,
      ),
    ).toBeUndefined();
  });
});
