import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { SELECT_OPTION_CATEGORIES } from '../select-options.constants';

export class CreateSelectOptionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(SELECT_OPTION_CATEGORIES)
  category: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsObject()
  labels: Record<string, string>;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}