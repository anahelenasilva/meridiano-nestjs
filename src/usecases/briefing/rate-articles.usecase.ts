import { Injectable } from '@nestjs/common';
import { ProcessorService } from '../../processor/processor.service';
import {
  RateArticlesInputDto,
  RateArticlesOutputDto,
} from './dto/rate-articles.dto';

@Injectable()
export class RateArticlesUseCase {
  constructor(private readonly processorService: ProcessorService) { }

  async execute(input: RateArticlesInputDto): Promise<RateArticlesOutputDto> {
    const stats = await this.processorService.rateArticles(input.feedProfile);

    return {
      articlesRated: stats.articlesRated,
      errors: stats.errors,
    };
  }
}
