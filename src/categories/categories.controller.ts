import { ApiKeyAllowed } from '@libs/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { CreateCategoryCommand } from './commands/create-category.command';
import { DeleteCategoryCommand } from './commands/delete-category.command';
import { RenameCategoryCommand } from './commands/rename-category.command';
import {
  CategoryResponseDto,
  CategoryWithCountResponseDto,
  CreateCategoryDto,
  RenameCategoryDto,
} from './entities/category.entity';
import { ListCategoriesQuery } from './queries/list-categories.query';

@Controller('api/youtube/categories')
@ApiAuthErrorResponse()
export class CategoriesController {
  constructor(
    private readonly listCategoriesQuery: ListCategoriesQuery,
    private readonly createCategoryCommand: CreateCategoryCommand,
    private readonly renameCategoryCommand: RenameCategoryCommand,
    private readonly deleteCategoryCommand: DeleteCategoryCommand,
  ) {}

  @Get()
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'List categories with their channel counts' })
  @ApiOkResponse({ type: CategoryWithCountResponseDto, isArray: true })
  async listCategories() {
    const categories = await this.listCategoriesQuery.execute();
    return categories.map(
      (category) => new CategoryWithCountResponseDto(category),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a category (color assigned automatically)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiValidationErrorResponse()
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.createCategoryCommand.execute(dto.name);
    return new CategoryResponseDto(category);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiValidationErrorResponse()
  async renameCategory(
    @Param('id') id: string,
    @Body() dto: RenameCategoryDto,
  ) {
    const category = await this.renameCategoryCommand.execute(id, dto.name);
    return new CategoryResponseDto(category);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a category and its channel associations only',
  })
  @ApiOkResponse({ description: 'Category deleted' })
  async deleteCategory(@Param('id') id: string) {
    await this.deleteCategoryCommand.execute(id);
  }
}
