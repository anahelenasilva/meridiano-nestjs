import { NotFoundException } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { mock, mockReset } from 'jest-mock-extended';
import { DismissIngestJobCommand } from './dismiss-ingest-job.command';

describe('DismissIngestJobCommand', () => {
  const mockQueue = mock<Queue>();
  let command: DismissIngestJobCommand;

  beforeEach(() => {
    mockReset(mockQueue);
    command = new DismissIngestJobCommand(mockQueue);
  });

  it('throws NotFoundException when the job is gone', async () => {
    mockQueue.getJob.mockResolvedValue(undefined);

    await expect(command.execute('channel-1:aaa')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removes the job and reports it dismissed', async () => {
    const mockJob = mock<Job>();
    mockQueue.getJob.mockResolvedValue(mockJob);

    const result = await command.execute('channel-1:aaa');

    expect(mockJob.remove).toHaveBeenCalled();
    expect(result).toEqual({ dismissed: true });
  });
});
