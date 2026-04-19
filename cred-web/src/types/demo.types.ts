export interface ReviewBlock {
  id: string
  restaurant_name: string
  reviewer_name: string
  review_text: string
  rating: number
  response_a: string
  response_b: string
  response_c: string
}

export interface PricingPlan {
  name: string
  priceMonthly: number
  priceAnnual: number
  features: string[]
  highlighted: boolean
  paddlePriceId: string
}
