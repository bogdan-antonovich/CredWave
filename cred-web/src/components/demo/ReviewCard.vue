<script setup lang="ts">
import { ref, computed } from 'vue'
import { Copy, Check, User, ExternalLink } from 'lucide-vue-next'
import type { ReviewBlock } from '@/types/demo.types'
import StarRating from '@/components/shared/StarRating.vue'

const props = defineProps<{
  block: ReviewBlock
}>()

const tones = [
  { key: 'response_a' as const, label: 'Empathetic' },
  { key: 'response_b' as const, label: 'Professional' },
  { key: 'response_c' as const, label: 'Casual' },
]

const activeTab = ref(0)
const copied = ref(false)

const activeResponse = computed(() => {
  const key = tones[activeTab.value].key
  return props.block[key]
})

const ratingLabel = computed(() => {
  if (props.block.rating >= 4) return { text: 'Positive', class: 'bg-emerald-50 text-emerald-600' }
  if (props.block.rating >= 3) return { text: 'Mixed', class: 'bg-amber-50 text-amber-600' }
  return { text: 'Negative', class: 'bg-red-50 text-red-600' }
})


async function copyResponse() {
  try {
    await navigator.clipboard.writeText(activeResponse.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="border border-border rounded-2xl bg-white overflow-hidden">
    <!-- Review top bar -->
    <div class="flex items-center justify-between px-6 pt-5 pb-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-surface-warm flex items-center justify-center shrink-0">
          <User class="w-4 h-4 text-text-muted" />
        </div>
        <div>
          <p class="text-sm font-semibold text-text-primary leading-tight">{{ block.reviewer_name }}</p>
          <StarRating :rating="block.rating" class="mt-0.5" />
        </div>
      </div>
      <span
        class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
        :class="ratingLabel.class"
      >
        {{ ratingLabel.text }}
      </span>
    </div>

    <!-- Review text -->
    <div class="px-6 pt-3 pb-5">
      <p class="text-sm text-text-secondary leading-relaxed">"{{ block.review_text }}"</p>
    </div>

    <!-- Response section -->
    <div class="border-t border-border-subtle">
      <!-- Tone tabs — minimal, underline style -->
      <div class="flex px-6 gap-0 border-b border-border-subtle">
        <button
          v-for="(tone, i) in tones"
          :key="tone.key"
          class="relative px-4 py-3 text-xs font-semibold transition-colors duration-200"
          :class="activeTab === i
            ? 'text-text-primary'
            : 'text-text-muted hover:text-text-secondary'"
          @click="activeTab = i"
        >
          {{ tone.label }}
          <!-- Active indicator -->
          <span
            v-if="activeTab === i"
            class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
          />
        </button>
      </div>

      <!-- Active response -->
      <div class="px-6 pt-4 pb-5 bg-surface-warm/30">
        <p class="text-sm text-text-primary leading-relaxed">{{ activeResponse }}</p>

        <!-- Actions -->
        <div class="flex items-center gap-2 mt-4">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg transition-all duration-200 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium"
            :class="copied
              ? 'bg-success/10 text-success'
              : 'bg-brand text-white hover:bg-brand-subtle'"
            :title="copied ? 'Copied!' : 'Copy response'"
            @click="copyResponse"
          >
            <Check v-if="copied" class="w-3.5 h-3.5 shrink-0" />
            <Copy v-else class="w-3.5 h-3.5 shrink-0" />
            <span class="hidden sm:inline">{{ copied ? 'Copied!' : 'Copy Response' }}</span>
          </button>
          <a
            v-if="block.link"
            :href="block.link"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all duration-200 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium"
            title="Reply on Google"
          >
            <ExternalLink class="w-3.5 h-3.5 shrink-0" />
            <span class="hidden sm:inline">Reply on Google</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
