import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import type {
  TranscriptionFilter,
  TranscriptionPage,
} from '../services/youtube-transcriptions.service';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A class, not a plain type, so the global ValidationPipe converts page and
// perPage to numbers and turns a malformed value or unknown key into a 400.
// startDate and endDate are UTC calendar days, both inclusive.
export class ListTranscriptionsLeanRequest
  implements TranscriptionFilter, Partial<TranscriptionPage>
{
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'startDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate?: string;
}
