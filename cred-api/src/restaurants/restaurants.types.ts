import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export interface Restaurant {
  id: string;
  userId: string;
  googlePlaceId: string | null;
  name: string;
  slug: string;
  address: string | null;
  ownerName: string | null;
  additionalInfo: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googlePhotoUrl: string | null;
  googleDescription: string | null;
  restaurantChangedAt: Date | null;
  updatedAt: Date;
}

export class SwitchRestaurantDto {
  @IsString()
  @IsNotEmpty()
  placeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address: string | null;
}

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  placeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address: string | null;
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
