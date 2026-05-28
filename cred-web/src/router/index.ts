import type { RouterScrollBehavior } from 'vue-router'
import { config } from '@/config/env'
import { isDashboardDomain } from '@/utils/domain'

export const routes = isDashboardDomain
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
        path: '/auth/signout',
        name: 'auth-signout',
        component: () => import('@/pages/AuthSignoutPage.vue'),
      },
      {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/LoginPage.vue'),
      },
      {
        path: '/blog',
        name: 'blog',
        component: () => import('@/pages/blog/BlogPage.vue'),
      },
      {
        path: '/blog/how-to-respond-to-negative-google-reviews',
        name: 'blog-negative-reviews',
        component: () => import('@/pages/blog/NegativeReviewsPage.vue'),
      },
      {
        path: '/blog/how-to-respond-to-positive-google-reviews',
        name: 'blog-positive-reviews',
        component: () => import('@/pages/blog/PositiveReviewsPage.vue'),
      },
      {
        path: '/blog/google-review-response-templates',
        name: 'blog-templates',
        component: () => import('@/pages/blog/ReviewTemplatesPage.vue'),
      },
      {
        path: '/blog/how-to-get-more-google-reviews',
        name: 'blog-get-more-reviews',
        component: () => import('@/pages/blog/GetMoreReviewsPage.vue'),
      },
      {
        path: '/blog/why-respond-to-every-google-review',
        name: 'blog-why-respond',
        component: () => import('@/pages/blog/WhyRespondPage.vue'),
      },
      {
        path: '/blog/how-to-deal-with-fake-google-reviews',
        name: 'blog-fake-reviews',
        component: () => import('@/pages/blog/FakeReviewsPage.vue'),
      },
      {
        path: '/blog/restaurant-reputation-management',
        name: 'blog-reputation-guide',
        component: () => import('@/pages/blog/ReputationGuidePage.vue'),
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
      {
        path: '/refund',
        name: 'refund',
        component: () => import('@/pages/RefundPage.vue'),
      },
      // Redirect /dashboard to the subdomain
      {
        path: '/dashboard',
        redirect: () => {
          if (typeof window !== 'undefined') {
            window.location.href = config.dashboardUrl || '/dashboard'
          }
          return '/'
        },
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
      },
    ]

export const scrollBehavior: RouterScrollBehavior = (to) => {
  if (to.hash) return { el: to.hash, behavior: 'smooth' }
  return { top: 0 }
}
