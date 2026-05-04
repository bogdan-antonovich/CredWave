<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  void router.replace({ name: 'auth' })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-dark">
    <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>
