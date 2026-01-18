import { S3Client } from '@aws-sdk/client-s3';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { S3Service } from './s3.service';

jest.mock('@aws-sdk/client-s3');

describe('S3Service', () => {
  let service: S3Service;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockSend = jest.fn();
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      mockSend.mockResolvedValueOnce({
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
      const fileContent = '# Título com Acentuação\n\n© 2024 • Special chars: é, ñ, ü';

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
});
