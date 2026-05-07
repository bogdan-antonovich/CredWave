<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Send, Check, Loader2, Zap, ChevronDown, RefreshCw, Sparkles, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-vue-next'
import StarRating from '@/components/shared/StarRating.vue'
import { useUserStore } from '@/stores/user.store'
import { useReviewsStore } from '@/stores/reviews.store'
import type { ReviewResponses } from '@/stores/reviews.store'

const userStore = useUserStore()
const reviewsStore = useReviewsStore()

const toneLabels: Record<string, string> = {
  empathetic: 'Empathetic',
  professional: 'Professional',
  casual: 'Casual',
}

const showToneDropdown = ref(false)
const activeStatus = ref('all')
const activeTab = ref<Record<string, keyof ReviewResponses>>({})
const editedText = ref<Record<string, string>>({})

// Fetch when restaurant is ready
watch(
  () => userStore.restaurantId,
  (id) => {
    if (id) void reviewsStore.fetchReviews(id, 1, activeStatus.value)
  },
  { immediate: true },
)

// Initialise local tone/text state when reviews arrive or responses are generated
watch(
  () => reviewsStore.reviews,
  (newReviews) => {
    for (const review of newReviews) {
      if (review.responses && !activeTab.value[review.id]) {
        const tone = userStore.autoReply.defaultTone
        activeTab.value[review.id] = tone
        editedText.value[review.id] = review.responses[tone]
      }
    }
  },
  { deep: true },
)

function selectTone(reviewId: string, tone: keyof ReviewResponses) {
  activeTab.value[reviewId] = tone
  const review = reviewsStore.reviews.find((r) => r.id === reviewId)
  if (review?.responses) {
    editedText.value[reviewId] = review.responses[tone]
  }
}

async function handleGenerate(reviewId: string) {
  await reviewsStore.generateReplies(reviewId)
  const review = reviewsStore.reviews.find((r) => r.id === reviewId)
  if (review?.responses) {
    const tone = userStore.autoReply.defaultTone
    activeTab.value[reviewId] = tone
    editedText.value[reviewId] = review.responses[tone]
  }
}

async function handleReply(reviewId: string) {
  const text = editedText.value[reviewId]
  if (!text?.trim()) return
  await reviewsStore.postReply(reviewId, text)
}

function setStatus(status: string) {
  activeStatus.value = status
  if (userStore.restaurantId) {
    void reviewsStore.fetchReviews(userStore.restaurantId, 1, status)
  }
}

function goToPage(page: number) {
  if (userStore.restaurantId) {
    void reviewsStore.fetchReviews(userStore.restaurantId, page, activeStatus.value)
  }
}

function handleSync() {
  if (userStore.restaurantId) {
    void reviewsStore.fetchReviews(userStore.restaurantId, reviewsStore.pagination.page, activeStatus.value)
  }
}

function setAutoTone(tone: 'empathetic' | 'professional' | 'casual') {
  userStore.setAutoReplyTone(tone)
  showToneDropdown.value = false
}

const hasPrev = computed(() => reviewsStore.pagination.page > 1)
const hasNext = computed(
  () => reviewsStore.pagination.page < reviewsStore.pagination.total_pages,
)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold font-display text-text-primary">Reviews</h1>
        <p class="text-sm text-text-muted mt-0.5">
          <span class="text-accent font-semibold">{{ reviewsStore.stats.pending }}</span> pending ·
          <span class="text-success font-semibold">{{ reviewsStore.stats.replied }}</span> replied
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Sync button -->
        <button
          class="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border transition-all"
          :disabled="reviewsStore.loading"
          title="Refresh reviews"
          @click="handleSync"
        >
          <RefreshCw class="w-4 h-4" :class="reviewsStore.loading ? 'animate-spin' : ''" />
        </button>

        <!-- Auto-reply controls -->
        <div class="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-white">
          <div class="flex items-center gap-2">
            <Zap class="w-4 h-4" :class="userStore.autoReply.enabled ? 'text-accent' : 'text-text-muted'" />
            <span class="text-sm font-medium text-text-primary">Auto-reply</span>
          </div>

          <div class="relative">
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border transition-colors"
              :class="userStore.autoReply.enabled ? 'bg-accent/5 text-accent border-accent/20' : 'text-text-muted bg-surface-warm'"
              @click="showToneDropdown = !showToneDropdown"
            >
              {{ toneLabels[userStore.autoReply.defaultTone] }}
              <ChevronDown class="w-3 h-3" />
            </button>
            <div
              v-if="showToneDropdown"
              class="absolute top-full right-0 mt-1 w-36 bg-white border border-border-subtle rounded-lg shadow-lg py-1 z-10"
            >
              <button
                v-for="(label, key) in toneLabels"
                :key="key"
                class="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-warm transition-colors"
                :class="userStore.autoReply.defaultTone === key ? 'text-accent font-semibold' : 'text-text-secondary'"
                @click="setAutoTone(key as 'empathetic' | 'professional' | 'casual')"
              >
                {{ label }}
              </button>
            </div>
          </div>

          <button
            class="relative w-10 h-5.5 rounded-full transition-colors duration-200"
            :class="userStore.autoReply.enabled ? 'bg-accent' : 'bg-border'"
            @click="userStore.setAutoReplyEnabled(!userStore.autoReply.enabled)"
          >
            <span
              class="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all duration-200"
              :class="userStore.autoReply.enabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Status filter tabs -->
    <div class="flex gap-1 mb-6 border-b border-border-subtle">
      <button
        v-for="s in ['all', 'pending', 'replied']"
        :key="s"
        class="relative px-4 py-2.5 text-xs font-semibold capitalize transition-colors"
        :class="activeStatus === s ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'"
        @click="setStatus(s)"
      >
        {{ s }}
        <span
          v-if="activeStatus === s"
          class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
        />
      </button>
    </div>

    <!-- No restaurant -->
    <div
      v-if="!userStore.loading && !userStore.restaurantId"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <p class="text-sm text-text-muted">No restaurant connected yet.</p>
      <p class="text-xs text-text-muted mt-1">Connect your Google Business account to start syncing reviews.</p>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="reviewsStore.loading" class="flex justify-center py-20">
      <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="reviewsStore.reviews.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <p class="text-sm text-text-muted">No reviews found.</p>
    </div>

    <!-- Review cards -->
    <div v-else class="space-y-5">
      <div
        v-for="review in reviewsStore.reviews"
        :key="review.id"
        class="border border-border rounded-2xl bg-white overflow-hidden"
        :class="review.replied ? 'opacity-60' : ''"
      >
        <!-- Review header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-surface-warm flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-text-muted">
                {{ (review.reviewerName || '?').charAt(0) }}
              </span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-text-primary">{{ review.reviewerName }}</p>
                <span
                  v-if="review.replied"
                  class="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-full"
                >
                  Replied
                </span>
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <StarRating :rating="review.rating" />
                <span class="text-[10px] text-text-muted">{{ formatDate(review.postedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Review text -->
        <div class="px-6 pt-3 pb-5">
          <p class="text-sm text-text-secondary leading-relaxed">"{{ review.reviewText }}"</p>
        </div>

        <!-- Response section — only for pending reviews -->
        <div v-if="!review.replied" class="border-t border-border-subtle">

          <!-- No responses yet: generate button -->
          <div v-if="!review.responses" class="px-6 py-4 bg-surface-warm/30 flex items-center justify-between">
            <p class="text-xs text-text-muted">No AI reply generated yet.</p>
            <button
              class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-all disabled:opacity-50"
              :disabled="reviewsStore.generating[review.id]"
              @click="handleGenerate(review.id)"
            >
              <Loader2 v-if="reviewsStore.generating[review.id]" class="w-3.5 h-3.5 animate-spin" />
              <Sparkles v-else class="w-3.5 h-3.5" />
              {{ reviewsStore.generating[review.id] ? 'Generating...' : 'Generate Replies' }}
            </button>
          </div>

          <!-- Responses ready: tone tabs + editor -->
          <template v-else>
            <div class="flex px-6 gap-0 border-b border-border-subtle">
              <button
                v-for="(label, key) in toneLabels"
                :key="key"
                class="relative px-4 py-3 text-xs font-semibold transition-colors duration-200"
                :class="activeTab[review.id] === key ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'"
                @click="selectTone(review.id, key as keyof ReviewResponses)"
              >
                {{ label }}
                <span
                  v-if="activeTab[review.id] === key"
                  class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
                />
              </button>
            </div>

            <div class="px-6 pt-4 pb-5 bg-surface-warm/30">
              <textarea
                v-model="editedText[review.id]"
                rows="4"
                class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 resize-none leading-relaxed"
              />

              <div class="flex items-center justify-between mt-3">
                <div class="flex items-center gap-2">
                  <p class="text-[10px] text-text-muted">Edit the response above before sending, or send as-is.</p>
                  <a
                    v-if="review.link"
                    :href="review.link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-[10px] text-accent hover:underline shrink-0"
                  >
                    <ExternalLink class="w-3 h-3" />
                    View on Google
                  </a>
                </div>
                <button
                  class="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                  :class="reviewsStore.sending[review.id] ? 'bg-accent/50 text-white' : 'bg-accent text-white hover:bg-accent-hover'"
                  :disabled="reviewsStore.sending[review.id] || !editedText[review.id]?.trim()"
                  @click="handleReply(review.id)"
                >
                  <Loader2 v-if="reviewsStore.sending[review.id]" class="w-3.5 h-3.5 animate-spin" />
                  <Send v-else class="w-3.5 h-3.5" />
                  {{ reviewsStore.sending[review.id] ? 'Posting...' : 'Post Reply' }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="reviewsStore.pagination.total_pages > 1"
      class="flex items-center justify-between mt-8"
    >
      <p class="text-xs text-text-muted">
        Page {{ reviewsStore.pagination.page }} of {{ reviewsStore.pagination.total_pages }}
        · {{ reviewsStore.pagination.total }} reviews
      </p>
      <div class="flex gap-2">
        <button
          class="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border transition-all disabled:opacity-30"
          :disabled="!hasPrev"
          @click="goToPage(reviewsStore.pagination.page - 1)"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border transition-all disabled:opacity-30"
          :disabled="!hasNext"
          @click="goToPage(reviewsStore.pagination.page + 1)"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
