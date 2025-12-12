import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import type { PaginatedArticleInput } from './article.entity';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Controller('api/articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly listArticlesQuery: ListArticlesQuery,
    private readonly getArticleByIdQuery: GetArticleByIdQuery,
    private readonly scraperService: ScraperService,
  ) { }

  @Post()
  async createArticle(@Body() createArticleDto: CreateArticleDto) {
    const { url, feedProfile } = createArticleDto;

    try {
      const articleId = await this.scraperService.scrapeSingleArticle(
        url,
        feedProfile,
      );

      if (articleId === null) {
        throw new BadRequestException('Article already exists in database');
      }

      return {
        success: true,
        articleId,
        message: 'Article scraped and saved successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ?
        error.message :
        'Unknown error occurred';

      throw new BadRequestException(
        `Failed to scrape article: ${errorMessage}`,
      );
    }
  }

  @Get()
  async listArticles(@Query() input: PaginatedArticleInput) {
    return await this.listArticlesQuery.execute(input);
  }

  @Get(':id')
  async getArticle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.getArticleByIdQuery.execute(id);

    if (!data || !data.article) {
      throw new NotFoundException('Article not found');
    }

    return data;
  }

  @Delete(':id')
  async deleteArticle(@Param('id', ParseIntPipe) id: number) {
    await this.articlesService.deleteArticleById(id);
    return { success: true };
  }
}
