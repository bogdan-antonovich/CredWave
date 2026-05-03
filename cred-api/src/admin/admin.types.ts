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
  responses: ReviewResponse[];
}
