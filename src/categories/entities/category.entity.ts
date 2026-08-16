import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Category, CategoryWithChannelCount } from '../domain/category';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @Transform(trim)
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(50, { message: 'Name must be at most 50 characters' })
  name: string;
}

export class RenameCategoryDto {
  @Transform(trim)
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(50, { message: 'Name must be at most 50 characters' })
  name: string;
}

export class CategoryResponseDto {
  id: string;
  name: string;
  color: string;

  constructor(category: Category) {
    this.id = category.id;
    this.name = category.name;
    this.color = category.color;
  }
}

export class CategoryWithCountResponseDto extends CategoryResponseDto {
  channelCount: number;

  constructor(category: CategoryWithChannelCount) {
    super(category);
    this.channelCount = category.channelCount;
  }
}
