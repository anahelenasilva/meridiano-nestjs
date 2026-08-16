import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { CategoryWithChannelCount } from '../domain/category';

@Injectable()
export class ListCategoriesQuery {
  constructor(private readonly categoriesService: CategoriesService) {}

  async execute(): Promise<CategoryWithChannelCount[]> {
    return this.categoriesService.listCategories();
  }
}
