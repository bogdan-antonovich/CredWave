<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'
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

  // On main domain: check subscription and decide where to send the user
  try {
    await api.get('/billing/subscription')
    // Has subscription → forward to dashboard subdomain with tokens
    const target = new URL(`${config.dashboardUrl}/auth/callback`)
    target.searchParams.set('access_token', accessToken)
    target.searchParams.set('refresh_token', refreshToken)
    window.location.href = target.toString()
  } catch {
    // No subscription → always send to main domain pricing page
    window.location.href = `${config.appUrl}/pricing`
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
