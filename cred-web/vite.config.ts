import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    includedRoutes() {
      return [
        '/',
        '/pricing',
        '/contact',
        '/privacy',
        '/terms',
        '/refund',
        '/demo',
        '/blog',
        '/blog/how-to-respond-to-negative-google-reviews',
        '/blog/how-to-respond-to-positive-google-reviews',
        '/blog/google-review-response-templates',
        '/blog/how-to-get-more-google-reviews',
        '/blog/why-respond-to-every-google-review',
        '/blog/how-to-deal-with-fake-google-reviews',
        '/blog/restaurant-reputation-management',
      ]
    },
  },
})
