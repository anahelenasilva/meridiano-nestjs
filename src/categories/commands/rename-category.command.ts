import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { Category } from '../domain/category';

@Injectable()
export class RenameCategoryCommand {
  constructor(private readonly categoriesService: CategoriesService) {}

  async execute(id: string, name: string): Promise<Category> {
    return this.categoriesService.renameCategory(id, name);
  }
}
