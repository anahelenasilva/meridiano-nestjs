import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { ConfigService } from '../../src/config/config.service';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;

  constructor(configService: ConfigService) {
    const { credentials, region } = configService.getAwsConfig();

    this.s3Client = new S3Client({
      region,
      credentials,
    });
  }

  async downloadMarkdownFile(bucketName: string, key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(
          `Empty response body for file ${key} in bucket ${bucketName}`,
        );
      }

      const bodyStream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of bodyStream) {
        chunks.push(Buffer.from(chunk));
      }

      const content = Buffer.concat(chunks).toString('utf-8');

      if (!content || content.trim() === '') {
        throw new Error(
          `Empty file content for ${key} in bucket ${bucketName}`,
        );
      }

      return content;
    } catch (error) {
      console.error('Error downloading markdown file:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('NoSuchKey')) {
        throw new Error(
          `File not found: ${key} in bucket ${bucketName} (NoSuchKey)`,
        );
      }

      if (errorMessage.includes('AccessDenied')) {
        throw new Error(
          `Access denied to file ${key} in bucket ${bucketName} (AccessDenied)`,
        );
      }

      throw new Error(
        `Failed to download file ${key} from bucket ${bucketName}: ${errorMessage}`,
      );
    }
  }

  async generatePresignedPostUrl(
    bucketName: string,
    key: string,
    contentType?: string,
    maxFileSize?: number,
  ): Promise<{
    url: string;
    fields: Record<string, string>;
    expiresIn: number;
  }> {
    const fiveMB = 5 * 1024 * 1024;
    const fileSizeLimit = maxFileSize || fiveMB;
    const expiresIn = 300;

    const allowedContentTypes = ['text/markdown', 'text/plain'];
    const finalContentType =
      contentType && allowedContentTypes.includes(contentType)
        ? contentType
        : 'text/markdown';

    try {
      const { url, fields } = await createPresignedPost(this.s3Client, {
        Bucket: bucketName,
        Key: key,
        Conditions: [
          ['content-length-range', 0, fileSizeLimit],
          ['eq', '$Content-Type', finalContentType],
        ],
        Fields: {
          'Content-Type': finalContentType,
        },
        Expires: expiresIn,
      });

      return {
        url,
        fields,
        expiresIn,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to generate presigned POST URL for ${key}: ${errorMessage}`,
      );
    }
  }

  async uploadAudioFile(
    bucketName: string,
    key: string,
    audioBuffer: Buffer,
    contentType?: string,
  ): Promise<string> {
    const finalContentType = contentType || 'audio/mpeg';

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: audioBuffer,
        ContentType: finalContentType,
      });

      await this.s3Client.send(command);

      return key;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to upload audio file ${key} to bucket ${bucketName}: ${errorMessage}`,
      );
    }
  }

  /**
   * Overwrite semantics: plain PutObject, no existence check. Use
   * uploadAudioFile for audio; this is the content-type-agnostic path.
   */
  async uploadFile(
    bucketName: string,
    key: string,
    body: PutObjectCommandInput['Body'],
    contentType: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      return key;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to upload file ${key} to bucket ${bucketName}: ${errorMessage}`,
      );
    }
  }

  /**
   * Removes a single object. Scoped to the exact key passed in, so callers
   * control the blast radius (never a prefix delete). S3 DeleteObject is
   * idempotent: deleting a missing key still resolves successfully.
   */
  async deleteObject(bucketName: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to delete object ${key} from bucket ${bucketName}: ${errorMessage}`,
      );
    }
  }

  async generatePresignedGetUrl(
    bucketName: string,
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      if (typeof presignedUrl !== 'string') {
        throw new Error(
          'Failed to generate presigned URL: invalid response type',
        );
      }

      return presignedUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Failed to generate presigned GET URL for ${key}: ${errorMessage}`,
      );
    }
  }
}
