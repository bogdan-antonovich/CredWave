<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'

// Clear any tokens stored on this domain, then go home.
// This page is the landing target when the dashboard redirects after
// logout or account deletion, so that credwave.app localStorage is
// wiped even though the clear happened on the dashboard subdomain.
const auth = useAuthStore()
auth.clearTokens()
window.location.href = '/'
</script>

<template>
  <div />
</template>
