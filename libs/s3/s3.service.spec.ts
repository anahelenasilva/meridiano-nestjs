import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { Readable } from 'stream';
import { ConfigService } from '../../src/config/config.service';
import { S3Service } from './s3.service';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-presigned-post');

describe('S3Service', () => {
  let service: S3Service;
  let mockSend: jest.Mock;
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSend = jest.fn();

    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    mockConfigService.getAwsConfig.mockReturnValue({
      credentials: undefined,
      region: 'us-east-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (mockSend) {
      mockSend.mockReset();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('downloadMarkdownFile', () => {
    it('should successfully download markdown file from S3', async () => {
      const bucketName = 'test-bucket';
      const key = 'test-file.md';
      const fileContent = '# Test Title\n\nTest content';

      const mockStream = Readable.from([fileContent]);

      mockSend.mockResolvedValue({
        Body: mockStream,
      });

      const result = await service.downloadMarkdownFile(bucketName, key);

      expect(result).toBe(fileContent);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle NoSuchKey error (file not found)', async () => {
      const bucketName = 'test-bucket';
      const key = 'nonexistent-file.md';

      const error = new Error('NoSuchKey: The specified key does not exist');
      mockSend.mockRejectedValueOnce(error);

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `File not found: ${key} in bucket ${bucketName} (NoSuchKey)`,
      );
    });

    it('should handle AccessDenied error', async () => {
      const bucketName = 'test-bucket';
      const key = 'restricted-file.md';

      const error = new Error('AccessDenied: Access Denied');
      mockSend.mockRejectedValueOnce(error);

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `Access denied to file ${key} in bucket ${bucketName} (AccessDenied)`,
      );
    });

    it('should handle network errors', async () => {
      const bucketName = 'test-bucket';
      const key = 'test-file.md';

      const error = new Error('Network error: Connection timeout');
      mockSend.mockRejectedValueOnce(error);

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `Failed to download file ${key} from bucket ${bucketName}: Network error: Connection timeout`,
      );
    });

    it('should handle empty file', async () => {
      const bucketName = 'test-bucket';
      const key = 'empty-file.md';

      const mockStream = Readable.from(['']);

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `Empty file content for ${key} in bucket ${bucketName}`,
      );
    });

    it('should handle empty response body', async () => {
      const bucketName = 'test-bucket';
      const key = 'test-file.md';

      mockSend.mockResolvedValueOnce({
        Body: undefined,
      });

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `Empty response body for file ${key} in bucket ${bucketName}`,
      );
    });

    it('should handle file with only whitespace', async () => {
      const bucketName = 'test-bucket';
      const key = 'whitespace-file.md';

      const mockStream = Readable.from(['   \n\n   ']);

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      await expect(
        service.downloadMarkdownFile(bucketName, key),
      ).rejects.toThrow(
        `Empty file content for ${key} in bucket ${bucketName}`,
      );
    });

    it('should download file with special characters in content', async () => {
      const bucketName = 'test-bucket';
      const key = 'special-chars.md';
      const fileContent =
        '# Título com Acentuação\n\n© 2024 • Special chars: é, ñ, ü';

      const mockStream = Readable.from([fileContent]);

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      const result = await service.downloadMarkdownFile(bucketName, key);

      expect(result).toBe(fileContent);
    });

    it('should download large file content', async () => {
      const bucketName = 'test-bucket';
      const key = 'large-file.md';
      const fileContent = '# Large File\n\n' + 'x'.repeat(10000);

      const mockStream = Readable.from([fileContent]);

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      const result = await service.downloadMarkdownFile(bucketName, key);

      expect(result).toBe(fileContent);
      expect(result.length).toBe(fileContent.length);
    });

    it('should handle file with multiple chunks', async () => {
      const bucketName = 'test-bucket';
      const key = 'multi-chunk.md';
      const chunk1 = '# Test Title\n\n';
      const chunk2 = 'First paragraph.\n\n';
      const chunk3 = 'Second paragraph.';
      const expectedContent = chunk1 + chunk2 + chunk3;

      const mockStream = Readable.from([chunk1, chunk2, chunk3]);

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      const result = await service.downloadMarkdownFile(bucketName, key);

      expect(result).toBe(expectedContent);
    });
  });

  describe('generatePresignedPostUrl', () => {
    const mockCreatePresignedPost = createPresignedPost as jest.MockedFunction<
      typeof createPresignedPost
    >;

    beforeEach(() => {
      mockCreatePresignedPost.mockClear();
    });

    it('should generate presigned POST URL with default settings', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = {
        key: 'articles/test-article.md',
        'Content-Type': 'text/markdown',
        bucket: 'test-bucket',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      const result = await service.generatePresignedPostUrl(bucketName, key);

      expect(result).toEqual({
        url: mockUrl,
        fields: mockFields,
        expiresIn: 300,
      });

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Bucket: bucketName,
          Key: key,
          Conditions: [
            ['content-length-range', 0, 5 * 1024 * 1024],
            ['eq', '$Content-Type', 'text/markdown'],
          ],
          Fields: {
            'Content-Type': 'text/markdown',
          },
          Expires: 300,
        }),
      );
    });

    it('should generate presigned POST URL with custom content type', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.txt';
      const contentType = 'text/plain';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = {
        key: 'articles/test-article.txt',
        'Content-Type': 'text/plain',
      };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      const result = await service.generatePresignedPostUrl(
        bucketName,
        key,
        contentType,
      );

      expect(result).toEqual({
        url: mockUrl,
        fields: mockFields,
        expiresIn: 300,
      });

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Conditions: expect.arrayContaining([
            ['eq', '$Content-Type', 'text/plain'],
          ]),
          Fields: {
            'Content-Type': 'text/plain',
          },
        }),
      );
    });

    it('should use default content type for invalid content type', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const invalidContentType = 'application/json';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = {
        key: 'articles/test-article.md',
        'Content-Type': 'text/markdown',
      };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      const result = await service.generatePresignedPostUrl(
        bucketName,
        key,
        invalidContentType,
      );

      expect(result.fields['Content-Type']).toBe('text/markdown');
      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Fields: {
            'Content-Type': 'text/markdown',
          },
        }),
      );
    });

    it('should generate presigned POST URL with custom file size', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const customFileSize = 2 * 1024 * 1024;
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = {
        key: 'articles/test-article.md',
        'Content-Type': 'text/markdown',
      };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      const result = await service.generatePresignedPostUrl(
        bucketName,
        key,
        undefined,
        customFileSize,
      );

      expect(result).toBeDefined();
      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Conditions: expect.arrayContaining([
            ['content-length-range', 0, customFileSize],
          ]),
        }),
      );
    });

    it('should handle errors when generating presigned POST URL', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const error = new Error('AWS credentials not configured');

      mockCreatePresignedPost.mockRejectedValueOnce(error);

      await expect(
        service.generatePresignedPostUrl(bucketName, key),
      ).rejects.toThrow(
        `Failed to generate presigned POST URL for ${key}: AWS credentials not configured`,
      );
    });

    it('should enforce 5MB default file size limit', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = { key };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      await service.generatePresignedPostUrl(bucketName, key);

      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Conditions: expect.arrayContaining([
            ['content-length-range', 0, 5 * 1024 * 1024],
          ]),
        }),
      );
    });

    it('should set expiration to 5 minutes (300 seconds)', async () => {
      const bucketName = 'test-bucket';
      const key = 'articles/test-article.md';
      const mockUrl = 'https://test-bucket.s3.amazonaws.com';
      const mockFields = { key };

      mockCreatePresignedPost.mockResolvedValueOnce({
        url: mockUrl,
        fields: mockFields,
      });

      const result = await service.generatePresignedPostUrl(bucketName, key);

      expect(result.expiresIn).toBe(300);
      expect(mockCreatePresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Expires: 300,
        }),
      );
    });
  });

  describe('uploadFile', () => {
    const mockPutObjectCommand = PutObjectCommand as jest.MockedClass<
      typeof PutObjectCommand
    >;

    it('should send a PutObjectCommand with the given bucket, key, body, and content type', async () => {
      const bucketName = 'test-bucket';
      const key = 'transcripts/processed.json';
      const body = JSON.stringify({ transcript: 'hello world' });
      const contentType = 'application/json';

      mockSend.mockResolvedValueOnce({});

      const result = await service.uploadFile(
        bucketName,
        key,
        body,
        contentType,
      );

      expect(result).toBe(key);
      expect(mockPutObjectCommand).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(mockPutObjectCommand));
    });

    it('should propagate errors as an upload failure', async () => {
      const bucketName = 'test-bucket';
      const key = 'transcripts/processed.json';
      const body = '{}';
      const contentType = 'application/json';

      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      await expect(
        service.uploadFile(bucketName, key, body, contentType),
      ).rejects.toThrow(
        `Failed to upload file ${key} to bucket ${bucketName}: AccessDenied`,
      );
    });
  });
});
