<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineProps<{
  name: string
  price: number
  period: string
  features: string[]
  highlighted: boolean
  ctaLabel?: string
}>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <div
    class="relative rounded-2xl border p-8 flex flex-col transition-all duration-300"
    :class="
      highlighted
        ? 'border-accent bg-surface-dark text-white shadow-2xl shadow-accent/10 scale-[1.03]'
        : 'border-border bg-white'
    "
  >
    <span
      v-if="highlighted"
      class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full bg-accent text-white shadow-lg shadow-accent/30"
    >
      Most Popular
    </span>

    <p
      class="text-xs font-semibold uppercase tracking-[0.15em]"
      :class="highlighted ? 'text-white/50' : 'text-text-muted'"
    >
      {{ name }}
    </p>

    <div class="mt-5 mb-7">
      <span class="text-5xl font-extrabold font-display">${{ price }}</span>
      <span
        class="text-sm ml-1"
        :class="highlighted ? 'text-white/40' : 'text-text-muted'"
      >
        /{{ period }}
      </span>
    </div>

    <ul class="space-y-3.5 flex-1 mb-8">
      <li
        v-for="(feature, i) in features"
        :key="i"
        class="flex items-start gap-2.5 text-sm"
        :class="highlighted ? 'text-white/70' : 'text-text-secondary'"
      >
        <Check
          class="w-4 h-4 shrink-0 mt-0.5"
          :class="highlighted ? 'text-indigo-400' : 'text-accent'"
        />
        {{ feature }}
      </li>
    </ul>

    <button
      class="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-[1px]"
      :class="
        highlighted
          ? 'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20'
          : 'bg-brand text-white hover:bg-brand-subtle shadow-sm'
      "
      @click="$emit('select')"
    >
      {{ ctaLabel || 'Start Free Trial' }}
    </button>
  </div>
</template>
