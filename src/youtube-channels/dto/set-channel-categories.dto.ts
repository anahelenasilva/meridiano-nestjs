import { IsCategoryNamesArray } from '../../categories/dto/category-names.decorator';

export class SetChannelCategoriesDto {
  @IsCategoryNamesArray()
  categoryNames: string[];
}
