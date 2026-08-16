import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryCommand } from './commands/create-category.command';
import { DeleteCategoryCommand } from './commands/delete-category.command';
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
  ],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
