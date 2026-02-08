export class AudioResponseDto {
  id: string;
  s3_key: string;
  file_size_bytes: number;
  duration_seconds?: number;
  presigned_url: string;
}
