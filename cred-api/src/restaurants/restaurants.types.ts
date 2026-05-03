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

export interface RestaurantChanges {
  name: string;
  ownerName: string;
  additionalInfo: string;
}

export interface RestaurantChanges {
  name: string;
  ownerName: string;
  additionalInfo: string;
}

export interface AutoReplyChanges {
  enabled: boolean;
  defaultTone: string;
  customInstructions: string;
}
