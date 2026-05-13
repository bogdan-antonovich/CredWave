import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export interface Restaurant {
  id: string;
  userId: string;
  googlePlaceId: string;
  name: string;
  slug: string;
  address: string | null;
  ownerName: string | null;
  additionalInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
  google_account_id: string;
  google_location_id: string;
}

export class RestaurantChanges {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  ownerName: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  additionalInfo: string;
}

export class AutoReplyChanges {
  @IsBoolean()
  enabled: boolean;

  @IsIn(['empathetic', 'professional', 'casual'])
  defaultTone: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  customInstructions: string;
}
