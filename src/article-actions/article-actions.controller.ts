import { ApiKeyAllowed } from '@libs/auth';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  PipeTransform,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import {
  ArticleActionResponseDto,
  PendingArticleQueryDto,
  PendingArticleResponseDto,
  SaveArticleActionDto,
  SHORT_ID_PATTERN,
  TransitionArticleActionDto,
} from './article-action.entity';
import { ArticleActionsService } from './article-actions.service';

class ShortIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!SHORT_ID_PATTERN.test(value)) {
      throw new BadRequestException(
        'shortId must be the first 8 lowercase hex characters of the article id',
      );
    }
    return value;
  }
}

// Hermes calls every route with the Meridiano API key: it polls for pending
// articles, saves each classification, and records Ana's typed approval.
@Controller('api/article-actions')
@ApiAuthErrorResponse()
export class ArticleActionsController {
  constructor(private readonly articleActionsService: ArticleActionsService) {}

  @Get('pending')
  @ApiKeyAllowed()
  @ApiOperation({
    summary:
      'Oldest processed Manual article since a Meridiano Day with no action yet',
  })
  @ApiOkResponse({ type: PendingArticleResponseDto })
  @ApiValidationErrorResponse()
  async findPending(
    @Query() query: PendingArticleQueryDto,
  ): Promise<PendingArticleResponseDto> {
    const article = await this.articleActionsService.findPending(query.since);
    return new PendingArticleResponseDto(article);
  }

  @Post()
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'Save the action classified for an article' })
  @ApiCreatedResponse({ type: ArticleActionResponseDto })
  @ApiValidationErrorResponse()
  @ApiNotFoundResponse({ description: 'Article does not exist' })
  @ApiConflictResponse({ description: 'Article already has an action' })
  async create(
    @Body() dto: SaveArticleActionDto,
  ): Promise<ArticleActionResponseDto> {
    const action = await this.articleActionsService.create(dto);
    return new ArticleActionResponseDto(action);
  }

  @Get(':shortId')
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'Get an article action by short id' })
  @ApiOkResponse({ type: ArticleActionResponseDto })
  @ApiNotFoundResponse({ description: 'No action has this short id' })
  @ApiConflictResponse({ description: 'Short id matches more than one action' })
  async getByShortId(
    @Param('shortId', ShortIdPipe) shortId: string,
  ): Promise<ArticleActionResponseDto> {
    const action = await this.articleActionsService.getByShortId(shortId);
    return new ArticleActionResponseDto(action);
  }

  @Put(':shortId')
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'Replace a proposed action' })
  @ApiOkResponse({ type: ArticleActionResponseDto })
  @ApiValidationErrorResponse()
  @ApiConflictResponse({ description: 'Action is not proposed' })
  async revise(
    @Param('shortId', ShortIdPipe) shortId: string,
    @Body() dto: SaveArticleActionDto,
  ): Promise<ArticleActionResponseDto> {
    const action = await this.articleActionsService.revise(shortId, dto);
    return new ArticleActionResponseDto(action);
  }

  @Patch(':shortId/status')
  @ApiKeyAllowed()
  @ApiOperation({
    summary: 'Move an action to dismissed, executing, executed or failed',
  })
  @ApiOkResponse({ type: ArticleActionResponseDto })
  @ApiValidationErrorResponse()
  @ApiConflictResponse({
    description: 'Transition not allowed from the current status',
  })
  async transition(
    @Param('shortId', ShortIdPipe) shortId: string,
    @Body() dto: TransitionArticleActionDto,
  ): Promise<ArticleActionResponseDto> {
    const action = await this.articleActionsService.transition(shortId, dto);
    return new ArticleActionResponseDto(action);
  }
}
