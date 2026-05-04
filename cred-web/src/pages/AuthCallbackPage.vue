<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (accessToken && refreshToken) {
    auth.setTokens(accessToken, refreshToken)
    void router.replace('/dashboard')
  } else {
    void router.replace('/auth')
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
