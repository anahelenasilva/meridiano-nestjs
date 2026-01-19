import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  articleFileName: string;

  @IsString()
  @IsOptional()
  s3Bucket?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['text/markdown', 'text/plain'])
  contentType?: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;
}
