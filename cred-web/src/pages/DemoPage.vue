<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'

useHead({
  title: 'Live Demo — CredWave',
  meta: [
    {
      name: 'description',
      content:
        'See AI-generated Google review responses for any restaurant in real time. No sign-up required.',
    },
  ],
})
import { Search, Sparkles, MapPin, ChevronRight, Star } from 'lucide-vue-next'
import { restaurantNameSchema } from '@/schemas/demo.schema'
import { useDemoStore, type SearchResult } from '@/stores/demo.store'
import FooterSection from '@/components/layout/FooterSection.vue'
import ReviewCard from '@/components/demo/ReviewCard.vue'
import { useReveal } from '@/utils/useReveal'

useReveal()
const demoStore = useDemoStore()
const input = ref('')
const validationError = ref<string | null>(null)

type Step = 'input' | 'searching' | 'disambiguation' | 'generating' | 'results'
const step = ref<Step>('input')

const loadingMessages = {
  searching: [
    'Searching Google Maps…',
    'Scanning listings…',
    'Matching restaurants…',
  ],
  generating: [
    'Reading reviews…',
    'Analyzing sentiment…',
    'Crafting responses…',
    'Choosing the right tone…',
    'Almost done…',
  ],
}

const currentLoadingMsg = ref('')
let msgInterval: ReturnType<typeof setInterval> | null = null

function startLoadingMessages(phase: 'searching' | 'generating') {
  const msgs = loadingMessages[phase]
  let idx = 0
  currentLoadingMsg.value = msgs[0]
  msgInterval = setInterval(() => {
    idx = Math.min(idx + 1, msgs.length - 1)
    currentLoadingMsg.value = msgs[idx]
  }, 1200)
}

function stopLoadingMessages() {
  if (msgInterval) clearInterval(msgInterval)
  msgInterval = null
}

async function handleGenerate() {
  validationError.value = null

  const result = restaurantNameSchema.safeParse({ restaurantName: input.value.trim() })
  if (!result.success) {
    validationError.value = result.error.issues[0].message
    return
  }

  step.value = 'searching'
  startLoadingMessages('searching')
  await demoStore.searchRestaurants(input.value.trim())
  stopLoadingMessages()

  if (demoStore.searchResults.length === 0) {
    step.value = 'input'
    validationError.value = 'No restaurants found. Try a different name or spelling.'
    return
  }

  step.value = 'disambiguation'
}

async function selectRestaurant(option: SearchResult) {
  step.value = 'generating'
  startLoadingMessages('generating')
  await demoStore.generateDemo(option.google_place_id, option.name)
  stopLoadingMessages()
  step.value = 'results'
}

function reset() {
  step.value = 'input'
  demoStore.reset()
  input.value = ''
  validationError.value = null
}

const showInput = computed(() => step.value === 'input')
const showLoading = computed(() => step.value === 'searching' || step.value === 'generating')
const showDisambiguation = computed(() => step.value === 'disambiguation')
const showResults = computed(() => step.value === 'results' && demoStore.blocks.length > 0)
const showEmpty = computed(() => step.value === 'results' && demoStore.blocks.length === 0)

onMounted(() => {
  const saved = demoStore.restoreFromStorage()
  if (!saved) return
  if (saved.phase === 'results') {
    step.value = 'results'
  } else if (saved.phase === 'disambiguation') {
    input.value = saved.query
    step.value = 'disambiguation'
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-warm flex flex-col">

    <main class="pt-14 flex-1">
      <!-- Header — always visible -->
      <section class="pt-24 pb-8 px-6">
        <div class="max-w-[560px] mx-auto text-center">
          <div class="hero-enter inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent/8 text-accent text-xs font-semibold mb-6">
            <Sparkles class="w-3 h-3" />
            Live Demo
          </div>
          <h1 class="hero-enter hero-enter-delay-1 text-3xl md:text-4xl font-bold font-display tracking-tight text-text-primary">
            Type your restaurant name.<br />Get 3 AI replies per review — instantly.
          </h1>
          <p class="hero-enter hero-enter-delay-2 mt-3 text-text-secondary text-lg">
            No signup. No credit card. Just paste your restaurant name and see what CredWave can do.
          </p>
        </div>
      </section>

      <!-- ═══ STEP: Input ═══ -->
      <section v-if="showInput" class="pb-24 px-6">
        <div class="max-w-[560px] mx-auto">
          <div class="hero-enter hero-enter-delay-3">
            <div class="flex flex-col sm:flex-row gap-2">
              <div class="relative flex-1">
                <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  v-model="input"
                  type="text"
                  placeholder="e.g. Bella Napoli"
                  class="w-full pl-10 pr-4 py-3.5 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 shadow-sm"
                  @keydown.enter="handleGenerate"
                />
              </div>
              <button
                class="w-full sm:w-auto px-6 py-3.5 bg-brand text-text-inverse text-sm font-semibold rounded-xl hover:bg-brand-subtle transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                @click="handleGenerate"
              >
                Generate Demo
              </button>
            </div>
            <p v-if="validationError" class="mt-2 text-xs text-error text-left">
              {{ validationError }}
            </p>
          </div>
        </div>
      </section>

      <!-- ═══ STEP: Loading ═══ -->
      <section v-if="showLoading" class="pb-24 px-6">
        <div class="max-w-[400px] mx-auto text-center py-16">
          <div class="flex items-center justify-center gap-2 mb-6">
            <span class="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style="animation-delay: 0ms;" />
            <span class="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style="animation-delay: 150ms;" />
            <span class="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style="animation-delay: 300ms;" />
          </div>
          <p class="text-sm font-medium text-text-primary transition-all duration-300">
            {{ currentLoadingMsg }}
          </p>
          <p class="mt-1.5 text-xs text-text-muted">This usually takes a few seconds</p>
        </div>
      </section>

      <!-- ═══ STEP: Disambiguation ═══ -->
      <section v-if="showDisambiguation" class="pb-24 px-6">
        <div class="max-w-[560px] mx-auto">
          <div class="reveal text-center mb-6">
            <p class="text-sm text-text-secondary">
              We found
              <span class="font-semibold text-text-primary">{{ demoStore.searchResults.length }}</span>
              restaurant{{ demoStore.searchResults.length !== 1 ? 's' : '' }} matching
              "<span class="font-semibold text-text-primary">{{ input.trim() }}</span>"
            </p>
          </div>

          <div class="reveal space-y-2">
            <button
              v-for="option in demoStore.searchResults"
              :key="option.google_place_id"
              class="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-white text-left hover:border-accent/40 hover:shadow-sm transition-all duration-200 group"
              @click="selectRestaurant(option)"
            >
              <div class="w-10 h-10 rounded-xl bg-surface-warm flex items-center justify-center shrink-0 group-hover:bg-accent/5 transition-colors duration-200">
                <MapPin class="w-4 h-4 text-text-muted group-hover:text-accent transition-colors duration-200" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-text-primary">{{ option.name }}</p>
                <p class="text-xs text-text-muted mt-0.5 leading-relaxed">{{ option.location }}</p>
                <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  <template v-if="option.rating">
                    <span class="flex items-center gap-0.5 text-xs text-text-muted">
                      <Star class="w-3 h-3 text-warning fill-warning" />
                      {{ option.rating }}
                    </span>
                  </template>
                  <template v-if="option.review_count">
                    <span class="text-text-muted text-xs">·</span>
                    <span class="text-xs text-text-muted">{{ option.review_count }} reviews</span>
                  </template>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-text-muted group-hover:text-accent shrink-0 transition-colors duration-200" />
            </button>
          </div>

          <div class="text-center mt-6">
            <button
              class="text-xs text-text-muted hover:text-text-secondary transition-colors"
              @click="reset"
            >
              ← Try a different name
            </button>
          </div>
        </div>
      </section>

      <!-- ═══ STEP: Results ═══ -->
      <section v-if="showResults" class="pb-24 px-6">
        <div class="max-w-[800px] mx-auto">
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

          <div class="text-center mt-8">
            <button
              class="text-sm text-accent font-medium hover:underline"
              @click="reset"
            >
              Try another restaurant
            </button>
          </div>

          <div class="reveal mt-12 p-10 rounded-2xl bg-surface-dark text-center">
            <p class="text-xl font-bold font-display text-white">
              What if every review got a response — without you lifting a finger?
            </p>
            <p class="mt-3 text-sm text-white/45 max-w-[440px] mx-auto">
              CredWave monitors your Google reviews 24/7. Every review, three responses, zero effort.
            </p>
            <RouterLink
              to="/pricing"
              class="inline-flex items-center mt-7 px-7 py-3.5 bg-accent text-white text-sm font-semibold rounded-full hover:bg-accent-hover transition-all duration-300 hover:scale-[1.02]"
            >
              View pricing
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- ═══ No results after generation ═══ -->
      <section v-if="showEmpty" class="pb-24 px-6">
        <div class="max-w-[400px] mx-auto text-center py-16">
          <p class="text-sm text-text-muted">No unanswered reviews found for this restaurant.</p>
          <button class="mt-4 text-sm text-accent font-medium hover:underline" @click="reset">
            Try another restaurant
          </button>
        </div>
      </section>
    </main>

    <FooterSection />
  </div>
</template>
