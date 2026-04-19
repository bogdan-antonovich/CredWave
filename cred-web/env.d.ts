/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PADDLE_VENDOR_ID: string
  readonly VITE_PADDLE_ENV: string
  readonly VITE_PADDLE_PRICE_STARTER_MONTHLY: string
  readonly VITE_PADDLE_PRICE_STARTER_ANNUAL: string
  readonly VITE_PADDLE_PRICE_GROWTH_MONTHLY: string
  readonly VITE_PADDLE_PRICE_GROWTH_ANNUAL: string
  readonly VITE_PADDLE_PRICE_SCALE_MONTHLY: string
  readonly VITE_PADDLE_PRICE_SCALE_ANNUAL: string
  readonly VITE_ADMIN_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
