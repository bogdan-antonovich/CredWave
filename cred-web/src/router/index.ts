import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { trackPageview } from '@/services/analytics'
import { config } from '@/config/env'
import { isDashboardDomain } from '@/utils/domain'

const router = createRouter({
  history: createWebHistory(),
  routes: isDashboardDomain
    ? [
        // ── Dashboard subdomain: routes live at root ──
        {
          path: '/',
          component: () => import('@/pages/dashboard/DashboardLayout.vue'),
          meta: { requiresAuth: true },
          children: [
            {
              path: '',
              name: 'dashboard',
              component: () => import('@/pages/dashboard/DashboardReviews.vue'),
            },
            {
              path: 'settings',
              name: 'dashboard-settings',
              component: () => import('@/pages/dashboard/DashboardSettings.vue'),
            },
            {
              path: 'billing',
              name: 'dashboard-billing',
              component: () => import('@/pages/dashboard/DashboardBilling.vue'),
            },
          ],
        },
        {
          path: '/admin',
          name: 'admin',
          component: () => import('@/pages/AdminPage.vue'),
          meta: { requiresAuth: true },
        },
        // Auth callback lands here after being forwarded from credwave.app
        {
          path: '/auth/callback',
          name: 'auth-callback',
          component: () => import('@/pages/AuthCallbackPage.vue'),
        },
        { path: '/:pathMatch(.*)*', redirect: '/' },
      ]
    : [
        // ── Main domain: marketing + auth routes ──
        {
          path: '/',
          name: 'home',
          component: () => import('@/pages/HomePage.vue'),
        },
        {
          path: '/demo',
          name: 'demo',
          component: () => import('@/pages/DemoPage.vue'),
        },
        {
          path: '/demo/:restaurantName',
          name: 'demo-v2',
          component: () => import('@/pages/DemoV2Page.vue'),
        },
        {
          path: '/pricing',
          name: 'pricing',
          component: () => import('@/pages/PricingPage.vue'),
        },
        {
          path: '/contact',
          name: 'contact',
          component: () => import('@/pages/ContactPage.vue'),
        },
        {
          path: '/auth',
          name: 'auth',
          component: () => import('@/pages/AuthPage.vue'),
        },
        {
          path: '/auth/callback',
          name: 'auth-callback',
          component: () => import('@/pages/AuthCallbackPage.vue'),
        },
        {
          path: '/login',
          name: 'login',
          component: () => import('@/pages/LoginPage.vue'),
        },
        {
          path: '/privacy',
          name: 'privacy',
          component: () => import('@/pages/PrivacyPage.vue'),
        },
        {
          path: '/terms',
          name: 'terms',
          component: () => import('@/pages/TermsPage.vue'),
        },
        // Redirect /dashboard to the subdomain
        {
          path: '/dashboard',
          redirect: () => {
            window.location.href = config.dashboardUrl || '/dashboard'
            return '/'
          },
        },
        {
          path: '/:pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/pages/NotFoundPage.vue'),
        },
      ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      if (isDashboardDomain) {
        // Unauthenticated on dashboard subdomain → send to main domain login
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

export default router
