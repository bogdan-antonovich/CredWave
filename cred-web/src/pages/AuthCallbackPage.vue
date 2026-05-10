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
  const res = await fetch(`${config.apiUrl}/billing/subscription`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null)

  const isAdmin = !res?.ok && (await fetch(`${config.apiUrl}/admin/restaurants`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null))?.ok

  if (res?.ok || isAdmin) {
    // Has subscription (or is admin) → forward to dashboard subdomain with tokens
    localStorage.removeItem('cw_pending_checkout')
    const target = new URL(`${config.dashboardUrl}/auth/callback`)
    target.searchParams.set('access_token', accessToken)
    target.searchParams.set('refresh_token', refreshToken)
    window.location.href = target.toString()
  } else {
    // No subscription → pricing on main domain
    // Any pending checkout priceId in localStorage will auto-open the Paddle checkout there
    window.location.href = `${config.appUrl}/pricing`
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
