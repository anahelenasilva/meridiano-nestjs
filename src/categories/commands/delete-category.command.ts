import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories.service';

@Injectable()
export class DeleteCategoryCommand {
  constructor(private readonly categoriesService: CategoriesService) {}

  async execute(id: string): Promise<void> {
    return this.categoriesService.deleteCategory(id);
  }
}
