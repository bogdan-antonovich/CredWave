import { z } from 'zod'

export const authSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

export type AuthInput = z.infer<typeof authSchema>
