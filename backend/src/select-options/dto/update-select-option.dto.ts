import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SELECT_OPTION_CATEGORIES } from '../select-options.constants';

export class UpdateSelectOptionDto {
  @IsOptional()
  @IsString()
  @IsIn(SELECT_OPTION_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}