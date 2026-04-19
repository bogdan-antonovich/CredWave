import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
      path: '/dashboard',
      component: () => import('@/pages/dashboard/DashboardLayout.vue'),
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
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
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
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
})

export default router
