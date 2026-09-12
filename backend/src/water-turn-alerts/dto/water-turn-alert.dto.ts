import { IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { WATER_TURN_RESPONSE } from '../schemas/water-turn-alert.schema';

export class CreateWaterTurnAlertDto {
  @IsMongoId()
  @IsNotEmpty()
  tubewellId: string;

  /** Operator estimate of remaining time on the current session (advisory only). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  estimatedRemainingMinutes?: number;
}

export class RespondWaterTurnAlertDto {
  @IsIn(Object.values(WATER_TURN_RESPONSE))
  response: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CancelWaterTurnAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}