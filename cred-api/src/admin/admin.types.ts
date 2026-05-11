export interface RestaurantCredentials {
  name: string;
  slug: string;
}

export interface ReviewResponse {
  text: string;
  tone: string;
}

export interface ReviewBlock {
  id: string;
  restaurantName: string;
  reviewerName: string;
  reviewText: string;
  rating: number;
  link: string;
  responses: ReviewResponse[];
}

export interface PromoCode {
  code: string;
  durationDays: number;
  expiresAt?: string;
  maxUses?: number;
  useCount?: number;
  isActive?: boolean;
}
