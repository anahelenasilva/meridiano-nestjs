import { IsString, MaxLength } from 'class-validator';

export class UpdateBriefTitleDto {
  // custom_title is an unbounded text column. Generated titles are prompted
  // as "max 8 words", so 200 leaves room for a hand-written one.
  @IsString()
  @MaxLength(200)
  customTitle: string;
}
