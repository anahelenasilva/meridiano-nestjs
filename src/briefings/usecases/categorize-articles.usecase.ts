import { Injectable } from '@nestjs/common';
import { ProcessorService } from '../../processor/processor.service';
import {
  CategorizeArticlesInputDto,
  CategorizeArticlesOutputDto,
} from './dto/categorize-articles.dto';

@Injectable()
export class CategorizeArticlesUseCase {
  constructor(private readonly processorService: ProcessorService) { }

  async execute(
    input: CategorizeArticlesInputDto,
  ): Promise<CategorizeArticlesOutputDto> {
    const stats = await this.processorService.categorizeArticles(
      input.feedProfile,
    );

    return {
      articlesCategorized: stats.articlesCategorized,
      errors: stats.errors,
    };
  }
}
