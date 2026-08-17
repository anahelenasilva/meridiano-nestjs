import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryCommand } from './commands/create-category.command';
import { DeleteCategoryCommand } from './commands/delete-category.command';
import { FindOrCreateCategoriesCommand } from './commands/find-or-create-categories.command';
import { RenameCategoryCommand } from './commands/rename-category.command';
import { ListCategoriesQuery } from './queries/list-categories.query';

@Module({
  imports: [DatabaseModule],
  providers: [
    CategoriesService,
    ListCategoriesQuery,
    CreateCategoryCommand,
    RenameCategoryCommand,
    DeleteCategoryCommand,
    FindOrCreateCategoriesCommand,
  ],
  controllers: [CategoriesController],
  exports: [CategoriesService, FindOrCreateCategoriesCommand],
})
export class CategoriesModule {}
