<script setup lang="ts">
import { RouterLink } from 'vue-router'
import NavBar from '@/components/layout/NavBar.vue'
import FooterSection from '@/components/layout/FooterSection.vue'
</script>

<template>
  <div class="min-h-screen bg-surface-warm flex flex-col">
    <NavBar />
    <main class="flex-1 flex flex-col items-center justify-center px-6 text-center pt-14">
      <p class="text-8xl font-extrabold font-display text-border tracking-tight select-none">404</p>
      <h1 class="mt-4 text-2xl font-bold font-display text-text-primary tracking-tight">
        Page not found
      </h1>
      <p class="mt-2 text-sm text-text-muted max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <RouterLink
        to="/"
        class="mt-8 inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-full bg-brand text-white hover:bg-brand-subtle transition-all duration-200 hover:scale-[1.02]"
      >
        Back to home
      </RouterLink>
    </main>
    <FooterSection />
  </div>
</template>
