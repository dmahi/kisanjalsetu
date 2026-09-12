import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { DISCOUNT_TYPE, PAYMENT_STATUS } from '../../common/constants';

export class StartSessionDto {
  @IsMongoId()
  tubewellId: string;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @IsOptional()
  @IsMongoId()
  cropId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cropName?: string;

  @IsOptional()
  @IsDateString()
  startDatetime?: string;

  @IsOptional()
  @IsMongoId()
  waterRequestId?: string;

  @IsOptional()
  @IsMongoId()
  waterQueueEntryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}

export class StopSessionDto {
  @IsOptional()
  @IsDateString()
  endDatetime?: string;
}

/** Customer self-serve start — the acting customer is the session owner. */
export class CustomerStartSessionDto {
  @IsMongoId()
  tubewellId: string;

  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @IsOptional()
  @IsMongoId()
  cropId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cropName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}

export class ManualSessionDto {
  @IsMongoId()
  tubewellId: string;

  @IsMongoId()
  customerId: string;

  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @IsOptional()
  @IsMongoId()
  cropId?: string;

  @IsOptional()
  @IsString()
  cropName?: string;

  @IsDateString()
  startDatetime: string;

  @IsDateString()
  endDatetime: string;

  @IsOptional()
  @IsIn([DISCOUNT_TYPE.FIXED, DISCOUNT_TYPE.PERCENTAGE])
  discountType?: 'fixed' | 'percentage';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsDateString()
  startDatetime?: string;

  @IsOptional()
  @IsDateString()
  endDatetime?: string;

  @IsOptional()
  @IsIn([DISCOUNT_TYPE.FIXED, DISCOUNT_TYPE.PERCENTAGE, null])
  discountType?: 'fixed' | 'percentage' | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsMongoId()
  cropId?: string;

  @IsOptional()
  @IsString()
  cropName?: string;
}

export class SessionFiltersQueryDto {
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @IsOptional()
  @IsMongoId()
  cropId?: string;

  @IsOptional()
  @IsIn(Object.values(PAYMENT_STATUS))
  paymentStatus?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}