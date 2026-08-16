import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { pickCategoryColor } from '../category-colors';
import { Category } from '../domain/category';

@Injectable()
export class CreateCategoryCommand {
  constructor(private readonly categoriesService: CategoriesService) {}

  async execute(name: string): Promise<Category> {
    const usedColors = await this.categoriesService.getUsedColors();
    const color = pickCategoryColor(usedColors);

    return this.categoriesService.createCategory(name, color);
  }
}
