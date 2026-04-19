import { z } from 'zod'

export const restaurantNameSchema = z.object({
  restaurantName: z
    .string()
    .min(2, 'Restaurant name must be at least 2 characters'),
})

export type RestaurantNameInput = z.infer<typeof restaurantNameSchema>
