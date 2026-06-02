import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RestaurantCredentials {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  slug: string;
}

export class ReviewResponse {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  tone: string;
}

export class ReviewBlock {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsNotEmpty()
  reviewerName: string;

  @IsString()
  @IsNotEmpty()
  reviewText: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  link: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewResponse)
  responses: ReviewResponse[];
}

export class PromoCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;
}

export class GenerateResponsesDto {
  @IsString()
  @IsNotEmpty()
  restaurantName: string;

  @IsString()
  @IsNotEmpty()
  reviewerName: string;

  @IsString()
  @IsNotEmpty()
  reviewText: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
