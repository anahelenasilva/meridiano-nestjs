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
import { CategoriesService } from './categories.service';
import {
  CategoryResponseDto,
  CategoryWithCountResponseDto,
  CreateCategoryDto,
  RenameCategoryDto,
} from './entities/category.entity';

@Controller('api/youtube/categories')
@ApiAuthErrorResponse()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiKeyAllowed()
  @ApiOperation({ summary: 'List categories with their channel counts' })
  @ApiOkResponse({ type: CategoryWithCountResponseDto, isArray: true })
  async listCategories() {
    const categories = await this.categoriesService.listCategories();
    return categories.map(
      (category) => new CategoryWithCountResponseDto(category),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a category (color assigned automatically)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiValidationErrorResponse()
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.categoriesService.createCategory(dto.name);
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
    const category = await this.categoriesService.renameCategory(id, dto.name);
    return new CategoryResponseDto(category);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a category and its channel associations only',
  })
  @ApiOkResponse({ description: 'Category deleted' })
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.deleteCategory(id);
  }
}
