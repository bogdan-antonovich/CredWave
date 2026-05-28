import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { routes, scrollBehavior } from './router'
import './assets/main.css'
import { initPaddle } from './services/paddle.service'
import { initAnalytics } from './services/analytics'
import { trackPageview } from './services/analytics'
import { useAuthStore } from './stores/auth.store'
import { isDashboardDomain } from './utils/domain'
import { config } from './config/env'

export const createApp = ViteSSG(
  App,
  { routes, scrollBehavior },
  ({ app, router, isClient }) => {
    app.use(createPinia())
    app.use(createHead())

    router.beforeEach((to) => {
      if (to.meta.requiresAuth) {
        const auth = useAuthStore()
        if (!auth.isAuthenticated) {
          if (isDashboardDomain) {
            window.location.href = config.appUrl ? `${config.appUrl}/auth` : 'https://credwave.app/auth'
            return false
          }
          return { name: 'auth' }
        }
      }
    })

    router.afterEach((to) => {
      trackPageview(to.fullPath)
    })

    if (isClient) {
      initAnalytics()
      initPaddle()
    }
  },
)
