export interface Review {
  id: string;
  restaurant_id: string;
  google_review_id: string;
  reviewer_name: string | null;
  reviewer_avatar_url: string | null;
  review_text: string | null;
  rating: number;
  posted_at: Date;
  replied: boolean;
  reply_text: string | null;
  replied_at: Date | null;
  responses: {
    empathetic: string;
    professional: string;
    casual: string;
  } | null;
  responses_generated_at: Date | null;
  created_at: Date;
}

export interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment: string;
  createTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface SerpReview {
  rating: number;
  snippet: string;
  iso_date: string;
  user: {
    name: string;
    thumbnail: string;
  };
  response?: {
    snippet: string;
    date: string;
  };
}

export interface SerpApiReviewsResponse {
  reviews?: SerpReview[];
}

export interface DemoBlock {
  reviewer_name: string;
  review_text: string;
  rating: number;
  empathetic: string;
  professional: string;
  casual: string;
}
