import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateYoutubeTranscriptionDto } from './create-youtube-transcription.dto';

// Pins the batch cap: several downstream tasks assume exactly 25.
describe('CreateYoutubeTranscriptionDto', () => {
  const makeDto = (urlCount: number) =>
    plainToInstance(CreateYoutubeTranscriptionDto, {
      urls: Array.from(
        { length: urlCount },
        (_, i) => `https://www.youtube.com/watch?v=${i}`,
      ),
      channelId: 'channel-1',
    });

  it('fails validation with an empty urls array', async () => {
    const errors = await validate(makeDto(0));

    expect(errors.some((e) => e.property === 'urls')).toBe(true);
  });

  it('passes validation with exactly 25 urls', async () => {
    const errors = await validate(makeDto(25));

    expect(errors).toHaveLength(0);
  });

  it('fails validation with 26 urls', async () => {
    const errors = await validate(makeDto(26));

    expect(errors.some((e) => e.property === 'urls')).toBe(true);
  });
});
