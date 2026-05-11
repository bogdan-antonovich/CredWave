<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Star, Copy, ExternalLink } from 'lucide-vue-next'

const tones = [
  {
    key: 'empathetic',
    label: 'Empathetic',
    reply: "Thank you so much, Marcus! Your kind words truly touched our whole team. We can't wait to welcome you back again soon!",
  },
  {
    key: 'professional',
    label: 'Professional',
    reply: "Thank you for your generous review, Marcus. We're pleased you enjoyed the pasta and our service. We look forward to welcoming you back.",
  },
  {
    key: 'casual',
    label: 'Casual',
    reply: "Marcus, this made our whole team smile — thank you! So glad you loved the pasta 🍝 Bring your friends next time!",
  },
]

const activeTab = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    activeTab.value = (activeTab.value + 1) % 3
  }, 2800)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div class="relative select-none">
    <div class="absolute -inset-6 bg-accent/10 blur-[70px] rounded-full pointer-events-none" />

    <!-- Card -->
    <div class="relative rounded-2xl bg-white/[0.06] border border-white/10 overflow-hidden shadow-2xl">

      <!-- Review header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span class="text-xs font-bold text-white/60">M</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-white leading-tight">Marcus W.</p>
            <div class="flex gap-0.5 mt-0.5">
              <Star v-for="i in 5" :key="i" class="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
          </div>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
          Positive
        </span>
      </div>

      <!-- Review text -->
      <div class="px-6 pt-3 pb-5">
        <p class="text-sm text-white/55 leading-relaxed">
          "Amazing food and service! The pasta was the best I've had in years. Will definitely be back with friends."
        </p>
      </div>

      <!-- Response section -->
      <div class="border-t border-white/[0.08]">

        <!-- Tone tabs — underline style -->
        <div class="flex sm:px-6 border-b border-white/[0.08]">
          <button
            v-for="(tone, i) in tones"
            :key="tone.key"
            class="relative flex-1 text-center py-2.5 sm:py-3 text-[11px] sm:text-xs font-semibold transition-colors duration-200"
            :class="activeTab === i ? 'text-white' : 'text-white/35'"
          >
            {{ tone.label }}
            <span
              v-if="activeTab === i"
              class="absolute bottom-0 left-0 right-0 sm:left-4 sm:right-4 h-[2px] bg-indigo-400 rounded-full"
            />
          </button>
        </div>

        <!-- Response text — fixed height to prevent card resize -->
        <div class="px-6 pt-4 pb-5 bg-white/[0.03]">
          <div class="h-[96px] sm:h-[72px] overflow-hidden">
            <p class="text-sm text-white/65 leading-relaxed">{{ tones[activeTab].reply }}</p>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium bg-accent text-white">
              <Copy class="w-3.5 h-3.5 shrink-0" />
              Copy Response
            </button>
            <button class="inline-flex items-center gap-1.5 rounded-lg border border-white/15 text-white/55 px-3.5 py-2 text-xs font-medium">
              <ExternalLink class="w-3.5 h-3.5 shrink-0" />
              Reply on Google
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Floating badge -->
    <div class="absolute -bottom-3 -left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-green-700/30 shadow-lg backdrop-blur-sm">
      <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
      <span class="text-[11px] font-medium text-green-300">Reply posted to Google</span>
    </div>
  </div>
</template>
