import { AUDIO_GENERATION_QUEUE } from '@libs/queue';
import { RedisService } from '@libs/redis';
import { Test, TestingModule } from '@nestjs/testing';
import { Job, JobState, Queue } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { GenerateAudioJobData } from '../interfaces/audio-job.interface';
import { AudioJobService } from './audio-job.service';

// Builds a minimal fake job: only the surface listActiveAndFailedJobs reads
// (data, getState, failedReason).
function fakeJob(
  data: GenerateAudioJobData,
  state: JobState,
  failedReason?: string,
): Job {
  return {
    data,
    failedReason,
    getState: jest.fn().mockResolvedValue(state),
  } as unknown as Job;
}

describe('AudioJobService', () => {
  let service: AudioJobService;
  const mockAudioQueue = mock<Queue>();
  const mockRedisService = mock<RedisService>();

  beforeEach(async () => {
    mockReset(mockAudioQueue);
    mockReset(mockRedisService);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioJobService,
        { provide: AUDIO_GENERATION_QUEUE, useValue: mockAudioQueue },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get(AudioJobService);
  });

  describe('listActiveAndFailedJobs', () => {
    it('scans the queue once, excluding completed', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([]);

      await service.listActiveAndFailedJobs();

      expect(mockAudioQueue.getJobs).toHaveBeenCalledTimes(1);
      expect(mockAudioQueue.getJobs).toHaveBeenCalledWith([
        'waiting',
        'active',
        'delayed',
        'paused',
        'failed',
      ]);
    });

    // BullMQ's JobState has no 'paused' value: a job sitting in a paused
    // queue still reports 'waiting' via getState() (queue.getJobs(['paused'])
    // is a listing filter, not a state getState() ever returns). 'prioritized'
    // and 'waiting-children' are the other not-yet-started states.
    it('maps waiting, delayed, prioritized and waiting-children to queued', async () => {
      const jobs = [
        fakeJob(
          { sourceType: 'article', sourceId: 'art-1', text: 't', date: new Date() },
          'waiting',
        ),
        fakeJob(
          { sourceType: 'article', sourceId: 'art-2', text: 't', date: new Date() },
          'delayed',
        ),
        fakeJob(
          { sourceType: 'transcription', sourceId: 'tr-1', text: 't', date: new Date() },
          'prioritized',
        ),
        fakeJob(
          { sourceType: 'transcription', sourceId: 'tr-6', text: 't', date: new Date() },
          'waiting-children',
        ),
      ];
      mockAudioQueue.getJobs.mockResolvedValue(jobs);

      const result = await service.listActiveAndFailedJobs();

      expect(result).toEqual([
        { source_type: 'article', source_id: 'art-1', state: 'queued', error: null },
        { source_type: 'article', source_id: 'art-2', state: 'queued', error: null },
        { source_type: 'transcription', source_id: 'tr-1', state: 'queued', error: null },
        { source_type: 'transcription', source_id: 'tr-6', state: 'queued', error: null },
      ]);
    });

    it('maps active to generating', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        fakeJob(
          { sourceType: 'transcription', sourceId: 'tr-2', text: 't', date: new Date() },
          'active',
        ),
      ]);

      const result = await service.listActiveAndFailedJobs();

      expect(result).toEqual([
        { source_type: 'transcription', source_id: 'tr-2', state: 'generating', error: null },
      ]);
    });

    it('maps failed to failed, carrying the failedReason as error', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        fakeJob(
          { sourceType: 'article', sourceId: 'art-3', text: 't', date: new Date() },
          'failed',
          'TTS provider timed out',
        ),
      ]);

      const result = await service.listActiveAndFailedJobs();

      expect(result).toEqual([
        {
          source_type: 'article',
          source_id: 'art-3',
          state: 'failed',
          error: 'TTS provider timed out',
        },
      ]);
    });

    it('sets error to null for non-failed states even when data allows it', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        fakeJob(
          { sourceType: 'article', sourceId: 'art-4', text: 't', date: new Date() },
          'active',
        ),
      ]);

      const [descriptor] = await service.listActiveAndFailedJobs();

      expect(descriptor.error).toBeNull();
    });

    it('omits a job that reports completed despite the scan excluding it', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        fakeJob(
          { sourceType: 'article', sourceId: 'art-5', text: 't', date: new Date() },
          'completed',
        ),
      ]);

      const result = await service.listActiveAndFailedJobs();

      expect(result).toEqual([]);
    });

    it('returns an empty array without throwing when the queue scan rejects', async () => {
      mockAudioQueue.getJobs.mockRejectedValue(new Error('redis unavailable'));

      const result = await service.listActiveAndFailedJobs();

      expect(result).toEqual([]);
    });
  });
});
