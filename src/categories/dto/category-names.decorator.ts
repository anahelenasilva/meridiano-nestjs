import { applyDecorators } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

const MAX_CATEGORIES_PER_CHANNEL = 20;

// Shared by every DTO that accepts a channel's desired category names
// (Add-Channel create path and the replace-the-set assignment endpoint).
export function IsCategoryNamesArray() {
  return applyDecorators(
    IsArray(),
    ArrayMaxSize(MAX_CATEGORIES_PER_CHANNEL, {
      message: `A channel may have at most ${MAX_CATEGORIES_PER_CHANNEL} categories`,
    }),
    IsString({ each: true, message: 'Each category name must be a string' }),
  );
}
