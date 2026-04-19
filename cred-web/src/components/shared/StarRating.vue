<script setup lang="ts">
import { Star } from 'lucide-vue-next'

defineProps<{
  rating: number
}>()
</script>

<template>
  <div class="flex gap-0.5">
    <Star
      v-for="i in 5"
      :key="i"
      class="w-4 h-4"
      :class="i <= rating ? 'text-warning fill-warning' : 'text-border'"
    />
  </div>
</template>
