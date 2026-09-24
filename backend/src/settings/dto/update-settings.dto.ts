import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  appName?: string;

  @IsOptional()
  @IsString()
  firebaseServiceAccount?: string;

  @IsOptional()
  @IsString()
  firebaseServerKey?: string;

  @IsOptional()
  @IsBoolean()
  showGoogleAds?: boolean;

  @IsOptional()
  @IsString()
  adMobBannerAdUnitId?: string;

  @IsOptional()
  @IsString()
  adSensePublisherId?: string;

  @IsOptional()
  @IsString()
  adSenseSlotId?: string;
}
