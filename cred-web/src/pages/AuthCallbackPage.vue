<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { api, ApiError } from '@/services/api'
import { config } from '@/config/env'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) {
    void router.replace('/auth')
    return
  }

  auth.setTokens(accessToken, refreshToken)

  try {
    await api.get('/billing/subscription')
    window.location.href = config.dashboardUrl || '/dashboard'
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      void router.replace('/pricing')
    } else {
      void router.replace('/pricing')
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
