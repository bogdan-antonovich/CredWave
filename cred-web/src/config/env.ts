export const config = {
  apiUrl: (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/v1',
  posthog: {
    key: (import.meta.env.VITE_POSTHOG_KEY as string) || '',
    host: (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://eu.i.posthog.com',
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL as string || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string || '',
  },
  paddle: {
    vendorId: import.meta.env.VITE_PADDLE_VENDOR_ID as string || '',
    environment: (import.meta.env.VITE_PADDLE_ENV as string) || 'sandbox',
    prices: {
      starterMonthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY as string || '',
      starterAnnual: import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL as string || '',
      growthMonthly: import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY as string || '',
      growthAnnual: import.meta.env.VITE_PADDLE_PRICE_GROWTH_ANNUAL as string || '',
      scaleMonthly: import.meta.env.VITE_PADDLE_PRICE_SCALE_MONTHLY as string || '',
      scaleAnnual: import.meta.env.VITE_PADDLE_PRICE_SCALE_ANNUAL as string || '',
    },
  },
  admin: {
    password: import.meta.env.VITE_ADMIN_PASSWORD as string || 'credwave2024',
  },
} as const
