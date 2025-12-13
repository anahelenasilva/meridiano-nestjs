import { IsOptional, IsString } from 'class-validator';

export class ProcessTranscriptionFilesInputDto {
  @IsOptional()
  @IsString()
  transcriptsDir?: string;
}

export interface ProcessTranscriptionFilesOutputDto {
  totalFiles: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ file: string; error: string }>;
}
