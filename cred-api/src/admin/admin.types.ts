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
  @MaxLength(5000)
  text: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tone: string;
}

export class ReviewBlock {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reviewerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  reviewText: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
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
  @MaxLength(200)
  restaurantName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reviewerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  reviewText: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
