import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateWaterRequestDto {
  @ApiProperty({ description: 'ID of the tubewell' })
  @IsMongoId()
  @IsNotEmpty()
  tubewellId: string;

  @ApiProperty({ description: 'ID of the farmer field' })
  @IsMongoId()
  @IsNotEmpty()
  fieldId: string;

  @ApiPropertyOptional({ description: 'ID of the crop' })
  @IsMongoId()
  @IsOptional()
  cropId?: string;

  @ApiPropertyOptional({ description: 'Name of the crop if not referenced by ID' })
  @IsString()
  @IsOptional()
  cropName?: string;

  @ApiProperty({ description: 'Requested duration in minutes' })
  @IsNumber()
  @Min(1)
  requestedDurationMinutes: number;

  @ApiPropertyOptional({ description: 'Requested date (ISO 8601 format)' })
  @IsISO8601()
  @IsOptional()
  requestedDate?: string;

  @ApiPropertyOptional({ description: 'Preferred start time (e.g. 09:00 AM)' })
  @IsString()
  @IsOptional()
  preferredStartTime?: string;

  @ApiPropertyOptional({ description: 'Preferred end time (e.g. 12:00 PM)' })
  @IsString()
  @IsOptional()
  preferredEndTime?: string;

  @ApiPropertyOptional({ description: 'Optional farmer note' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectWaterRequestDto {
  @ApiPropertyOptional({ description: 'Reason for rejecting the request' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class WaterRequestFiltersQueryDto {
  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  tubewellId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}
