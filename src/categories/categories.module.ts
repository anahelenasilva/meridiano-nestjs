import { DatabaseModule } from '@libs/database';
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { FindOrCreateCategoriesCommand } from './commands/find-or-create-categories.command';

@Module({
  imports: [DatabaseModule],
  providers: [CategoriesService, FindOrCreateCategoriesCommand],
  controllers: [CategoriesController],
  exports: [CategoriesService, FindOrCreateCategoriesCommand],
})
export class CategoriesModule {}
