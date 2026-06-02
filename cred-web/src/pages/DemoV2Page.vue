<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Loader2, Sparkles } from 'lucide-vue-next'
import { useDemoStore } from '@/stores/demo.store'
import FooterSection from '@/components/layout/FooterSection.vue'
import ReviewCard from '@/components/demo/ReviewCard.vue'
import { useReveal } from '@/utils/useReveal'

useReveal()
const route = useRoute()
const router = useRouter()
const demoStore = useDemoStore()

async function loadData() {
  const name = route.params.restaurantName as string
  if (!name) return
  await demoStore.fetchAdminBlocks(name)
  if (demoStore.error === 'not_found') {
    void router.replace({ name: 'not-found' })
  }
}

onMounted(loadData)
watch(() => route.params.restaurantName, loadData)
</script>

<template>
  <div class="min-h-screen bg-surface-warm flex flex-col">

    <main class="pt-14 flex-1">
      <section class="py-24 px-6">
        <div class="max-w-[800px] mx-auto">
          <div class="text-center mb-14">
            <div class="hero-enter inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent/8 text-accent text-xs font-semibold mb-4">
              <Sparkles class="w-3 h-3" />
              Demo
            </div>
            <h1 class="hero-enter hero-enter-delay-1 text-3xl font-bold font-display tracking-tight text-text-primary capitalize">
              {{ (route.params.restaurantName as string).replace(/-/g, ' ') }}
            </h1>
            <p class="hero-enter hero-enter-delay-2 mt-2 text-sm text-text-secondary">
              AI-generated review responses — click any to copy
            </p>
          </div>

          <div v-if="demoStore.loading" class="flex justify-center py-20">
            <Loader2 class="w-6 h-6 animate-spin text-text-muted" />
          </div>

          <div v-else-if="demoStore.error" class="text-center py-20">
            <p class="text-sm text-error">Something went wrong. Please try again later.</p>
          </div>

          <div v-else>
            <!-- Quick explainer -->
            <div class="reveal flex items-center gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10 mb-8">
              <div class="flex -space-x-1 shrink-0">
                <span class="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-[9px] font-bold text-rose-500 ring-2 ring-white">E</span>
                <span class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-accent ring-2 ring-white">P</span>
                <span class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-600 ring-2 ring-white">C</span>
              </div>
              <p class="text-sm text-text-secondary">
                <span class="font-semibold text-text-primary">3 tones per review.</span>
                Switch between Empathetic, Professional, and Casual. Copy the one you like and reply directly on Google.
              </p>
            </div>

            <div class="space-y-6">
              <div
                v-for="(block, idx) in demoStore.blocks"
                :key="block.id"
                class="reveal"
                :style="{ transitionDelay: `${idx * 80}ms` }"
              >
                <ReviewCard :block="block" />
              </div>
            </div>

            <div class="reveal mt-12 p-10 rounded-2xl bg-surface-dark text-center">
              <p class="text-xl font-bold font-display text-white">
                Tired of copy-pasting review responses?
              </p>
              <p class="mt-3 text-sm text-white/45 max-w-[440px] mx-auto">
                CredWave monitors your Google reviews 24/7. Every review, three responses, zero effort.
              </p>
              <RouterLink
                to="/pricing"
                class="inline-flex items-center mt-7 px-7 py-3.5 bg-accent text-white text-sm font-semibold rounded-full hover:bg-accent-hover transition-all duration-300 hover:scale-[1.02]"
              >
                Get started
              </RouterLink>
            </div>
          </div>
        </div>
      </section>
    </main>

    <FooterSection />
  </div>
</template>
