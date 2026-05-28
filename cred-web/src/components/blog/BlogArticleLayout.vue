<script setup lang="ts">
import { RouterLink } from 'vue-router'
import FooterSection from '@/components/layout/FooterSection.vue'

defineProps<{
  title: string
  description: string
  date: string
  readTime: string
}>()
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <div class="pt-14">
      <div class="max-w-[760px] mx-auto px-6 py-14">

        <RouterLink
          to="/blog"
          class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          All articles
        </RouterLink>

        <div class="mb-8">
          <h1 class="text-3xl sm:text-4xl font-bold font-display text-text-primary mb-4 leading-tight">{{ title }}</h1>
          <p class="text-base text-text-secondary leading-relaxed mb-5">{{ description }}</p>
          <div class="flex items-center gap-3 text-sm text-text-muted">
            <span>{{ date }}</span>
            <span>·</span>
            <span>{{ readTime }} read</span>
          </div>
        </div>

        <div class="h-px bg-border-subtle mb-10"></div>

        <div class="prose-article">
          <slot />
        </div>

        <div class="mt-16 rounded-2xl bg-brand p-8 text-white">
          <p class="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">CredWave</p>
          <h2 class="text-2xl font-bold font-display text-white mb-3">Stop responding manually</h2>
          <p class="text-sm text-white/65 leading-relaxed mb-6">
            CredWave syncs your Google reviews and generates on-brand AI responses automatically.
            No contracts — cancel anytime.
          </p>
          <RouterLink
            to="/pricing"
            class="inline-block bg-white text-brand text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-white/90 transition-colors"
          >
            See pricing →
          </RouterLink>
        </div>

      </div>
    </div>
    <FooterSection />
  </div>
</template>
