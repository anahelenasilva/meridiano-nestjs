import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials,
    });
  }

  async downloadMarkdownFile(
    bucketName: string,
    key: string,
  ): Promise<string> {
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
}
