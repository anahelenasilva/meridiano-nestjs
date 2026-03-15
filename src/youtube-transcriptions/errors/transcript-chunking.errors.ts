export class TranscriptChunkingError extends Error {
  constructor(
    message: string,
    public readonly transcriptionId: string,
    public readonly jobId: string,
  ) {
    super(message);
    this.name = 'TranscriptChunkingError';
  }
}

export class StructureExtractionError extends Error {
  constructor(
    message: string,
    public readonly transcriptionId: string,
    public readonly rawOutput?: string,
  ) {
    super(message);
    this.name = 'StructureExtractionError';
  }
}