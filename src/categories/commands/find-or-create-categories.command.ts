import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { Category } from '../domain/category';
import { CreateCategoryCommand } from './create-category.command';

function dedupeCaseInsensitive(names: string[]): string[] {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

@Injectable()
export class FindOrCreateCategoriesCommand {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly createCategoryCommand: CreateCategoryCommand,
  ) {}

  // Runs sequentially so each creation re-reads used colors from the DB,
  // avoiding two brand-new categories in the same batch getting the same color.
  async execute(names: string[]): Promise<Category[]> {
    const uniqueNames = dedupeCaseInsensitive(
      names.map((name) => name.trim()).filter((name) => name.length > 0),
    );

    const categories: Category[] = [];
    for (const name of uniqueNames) {
      const existing = await this.categoriesService.getCategoryByName(name);
      categories.push(
        existing ?? (await this.createCategoryCommand.execute(name)),
      );
    }

    return categories;
  }
}
