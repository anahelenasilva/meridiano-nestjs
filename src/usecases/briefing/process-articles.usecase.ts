import { Injectable } from '@nestjs/common';
import { ProcessorService } from '../../processor/processor.service';
import {
  ProcessArticlesInputDto,
  ProcessArticlesOutputDto,
} from './dto/process-articles.dto';

@Injectable()
export class ProcessArticlesUseCase {
  constructor(private readonly processorService: ProcessorService) { }

  async execute(
    input: ProcessArticlesInputDto,
  ): Promise<ProcessArticlesOutputDto> {
    const stats = await this.processorService.processArticles(
      input.feedProfile,
      1000,
      undefined,
      input.generateAudio,
    );

    return {
      articlesProcessed: stats.articlesProcessed,
      errors: stats.errors,
    };
  }
}
