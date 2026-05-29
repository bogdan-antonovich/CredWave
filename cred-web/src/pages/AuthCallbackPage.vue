<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { config } from '@/config/env'
import { isDashboardDomain } from '@/utils/domain'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) {
    void router.replace(isDashboardDomain ? '/' : '/auth')
    return
  }

  auth.setTokens(accessToken, refreshToken)

  if (isDashboardDomain) {
    // Tokens forwarded from credwave.app — just go home
    void router.replace('/')
    return
  }

  // On main domain: check subscription and decide where to send the user.
  // Use plain fetch — tokens are fresh, so no need for the api interceptor's
  // auto-refresh/auto-logout, which would wipe credwave.app localStorage on any failure.
  const headers = { Authorization: `Bearer ${accessToken}` }

  const [subRes, promoRes, adminRes] = await Promise.all([
    fetch(`${config.apiUrl}/billing/subscription`, { headers }).catch(() => null),
    fetch(`${config.apiUrl}/promo/access`, { headers }).catch(() => null),
    fetch(`${config.apiUrl}/admin/restaurants`, { headers }).catch(() => null),
  ])

  if (subRes?.ok || promoRes?.ok || adminRes?.ok) {
    // Has subscription (or is admin) → forward to dashboard subdomain with tokens
    localStorage.removeItem('cw_pending_checkout')
    const target = new URL(`${config.dashboardUrl}/auth/callback`)
    target.searchParams.set('access_token', accessToken)
    target.searchParams.set('refresh_token', refreshToken)
    window.location.href = target.toString()
  } else {
    // No subscription → pricing on main domain
    // If a promo code is pending, land on the promo section so it auto-redeems
    const hasPendingPromo = !!localStorage.getItem('cw_pending_promo')
    window.location.href = `${config.appUrl}/pricing${hasPendingPromo ? '#promo' : ''}`
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
