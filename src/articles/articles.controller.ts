import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import type { PaginatedArticleInput } from './article.entity';
import { ArticlesService } from './articles.service';
import { GetArticleByIdQuery } from './queries/get-article-by-id.query';
import { ListArticlesQuery } from './queries/list-articles.query';

@Controller('api/articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly listArticlesQuery: ListArticlesQuery,
    private readonly getArticleByIdQuery: GetArticleByIdQuery,
  ) {}

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
