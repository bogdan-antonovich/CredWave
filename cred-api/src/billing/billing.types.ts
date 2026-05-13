export interface Plan {
  name: string;
  price: number;
  period: string;
  status: string;
  nextBillingDate: string;
  paddleSubscriptionId: string;
}

export interface Usage {
  reviewsUsed: number;
  reviewsLimit: number;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expiry: string;
}

export interface Subscription {
  plan: Plan;
  usage: Usage;
  paymentMethod: PaymentMethod | null;
}

export interface WebhookMetadata {
  userId: number;
}
