<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Send, Check, Loader2, Zap, ChevronDown } from 'lucide-vue-next'
import StarRating from '@/components/shared/StarRating.vue'
import { useUserStore } from '@/stores/user.store'

const userStore = useUserStore()

// ── Mock reviews (will come from backend) ──
interface DashboardReview {
  id: string
  reviewer_name: string
  review_text: string
  rating: number
  posted_at: string
  replied: boolean
  responses: {
    empathetic: string
    professional: string
    casual: string
  }
}

const showToneDropdown = ref(false)

const toneLabels = {
  empathetic: 'Empathetic',
  professional: 'Professional',
  casual: 'Casual',
}

const reviews = ref<DashboardReview[]>([])
const loading = ref(true)

// Per-review state
const activeTab = ref<Record<string, string>>({})
const editedText = ref<Record<string, string>>({})
const sendingId = ref<string | null>(null)
const sentIds = ref<Set<string>>(new Set())

onMounted(async () => {
  // Simulate backend fetch
  await new Promise(r => setTimeout(r, 800))
  reviews.value = generateMockReviews()
  // Set defaults
  for (const r of reviews.value) {
    activeTab.value[r.id] = userStore.autoReply.defaultTone
    editedText.value[r.id] = r.responses[userStore.autoReply.defaultTone]
  }
  loading.value = false
})

function selectTone(reviewId: string, tone: string) {
  activeTab.value[reviewId] = tone
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) {
    editedText.value[reviewId] = review.responses[tone as keyof typeof review.responses]
  }
}

async function sendReply(reviewId: string) {
  sendingId.value = reviewId
  // Simulate posting to Google
  await new Promise(r => setTimeout(r, 1500))
  sentIds.value.add(reviewId)
  const review = reviews.value.find(r => r.id === reviewId)
  if (review) review.replied = true
  sendingId.value = null
}

function setAutoTone(tone: 'empathetic' | 'professional' | 'casual') {
  userStore.setAutoReplyTone(tone)
  showToneDropdown.value = false
}

const pendingCount = computed(() => reviews.value.filter(r => !r.replied).length)
const repliedCount = computed(() => reviews.value.filter(r => r.replied).length)

function generateMockReviews(): DashboardReview[] {
  return [
    {
      id: '1',
      reviewer_name: 'Maria S.',
      review_text: 'Absolutely loved the seafood risotto! The flavors were incredible and the portion size was generous. Our waiter Marco was attentive without being intrusive. Will definitely be back!',
      rating: 5,
      posted_at: '2 hours ago',
      replied: false,
      responses: {
        empathetic: "Maria, your kind words truly warm our hearts! We're so happy the seafood risotto hit the spot — our chef sources the freshest seafood daily just for dishes like that. And Marco will be thrilled to hear your praise! We can't wait to welcome you back.",
        professional: "Thank you for your wonderful review, Maria. We're delighted to hear you enjoyed the seafood risotto and that Marco provided excellent service. We take pride in our fresh ingredients and attentive team. We look forward to your next visit.",
        casual: "Hey Maria! So glad you loved the risotto — it's one of our favorites too! We'll pass the kind words to Marco, he'll be stoked. See you next time! 🎉",
      },
    },
    {
      id: '2',
      reviewer_name: 'Tom W.',
      review_text: 'Waited 40 minutes for a table even with a reservation. When we finally sat down, the appetizers took another 30 minutes. Food was okay but not worth the wait. Disappointing.',
      rating: 2,
      posted_at: '5 hours ago',
      replied: false,
      responses: {
        empathetic: "Tom, we're genuinely sorry about the long wait — we understand how frustrating that must have been, especially with a reservation. That's not the experience we want for our guests. We've already spoken with our host and kitchen teams to prevent this. We'd love to make it up to you with a complimentary dinner — please reach out to us directly.",
        professional: "Thank you for your feedback, Tom. We sincerely apologize for the delays you experienced. We're reviewing our reservation and kitchen processes to ensure this doesn't happen again. We value your time and would appreciate the opportunity to provide a better experience. Please contact us to arrange a return visit.",
        casual: "Ugh, Tom, that's not cool and we're sorry. 40 minutes with a reservation is way too long. We're fixing the process so this doesn't happen again. Hit us up — we'd love to give you a redo on the house.",
      },
    },
    {
      id: '3',
      reviewer_name: 'Sarah K.',
      review_text: 'Nice ambiance and great cocktails. The bruschetta was fresh and tasty. Only complaint is the music was a bit loud for conversation. Overall a pleasant evening.',
      rating: 4,
      posted_at: '1 day ago',
      replied: true,
      responses: {
        empathetic: "Sarah, thank you for the lovely feedback! We're thrilled you enjoyed our cocktails and bruschetta. We totally hear you on the music volume — we've actually been adjusting our evening playlists. Hope to see you again soon for another pleasant evening!",
        professional: "Thank you for your review, Sarah. We're pleased you enjoyed the ambiance, cocktails, and bruschetta. We appreciate the feedback about the music volume and will review our settings. We hope to welcome you again soon.",
        casual: "Thanks Sarah! Glad you vibed with the cocktails and bruschetta. We hear you on the music — we'll turn it down a notch so you can actually chat next time. Come back soon!",
      },
    },
    {
      id: '4',
      reviewer_name: 'James L.',
      review_text: 'First time here and it was fantastic. The pasta carbonara was the best I\'ve had outside of Rome. Cozy atmosphere and reasonable prices. Hidden gem!',
      rating: 5,
      posted_at: '1 day ago',
      replied: false,
      responses: {
        empathetic: "James, what an incredible compliment — best carbonara outside of Rome! Our chef will be over the moon. We're so glad you discovered us, and we love being your hidden gem. Can't wait for your next visit!",
        professional: "Thank you, James! We're honored by your comparison to Roman carbonara. Our chef uses traditional techniques and the finest ingredients to achieve authentic flavors. We appreciate you sharing your experience and look forward to serving you again.",
        casual: "Best carbonara outside Rome?! James, you just made our chef's entire week. Thanks for finding us — now spread the word (or don't, so we stay your hidden gem 😄). See you soon!",
      },
    },
    {
      id: '5',
      reviewer_name: 'Priya D.',
      review_text: 'The vegan options are seriously lacking. Only one main dish available and it was bland. For a restaurant in 2025, this is not acceptable. Please expand the menu.',
      rating: 2,
      posted_at: '2 days ago',
      replied: false,
      responses: {
        empathetic: "Priya, you're absolutely right, and we appreciate you being direct about it. Our vegan options haven't kept up, and that's on us. We're actively working with our chef to develop new plant-based dishes. Your feedback is exactly the push we needed. We'd love to have you back to try our expanded menu.",
        professional: "Thank you for your candid feedback, Priya. We acknowledge that our vegan offerings need improvement. We're currently developing new plant-based menu items and expect to launch them soon. We value your input and hope you'll give us another opportunity.",
        casual: "Fair point, Priya — one vegan dish isn't cutting it. We're on it! New plant-based options are in the works. When they drop, you'll be the first to know. Thanks for keeping us honest.",
      },
    },
  ]
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-xl font-bold font-display text-text-primary">Reviews</h1>
        <p class="text-sm text-text-muted mt-0.5">
          <span class="text-accent font-semibold">{{ pendingCount }}</span> pending ·
          <span class="text-success font-semibold">{{ repliedCount }}</span> replied
        </p>
      </div>

      <!-- Auto-reply toggle -->
      <div class="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-white">
        <div class="flex items-center gap-2">
          <Zap class="w-4 h-4" :class="userStore.autoReply.enabled ? 'text-accent' : 'text-text-muted'" />
          <span class="text-sm font-medium text-text-primary">Auto-reply</span>
        </div>

        <!-- Tone selector -->
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
              @click="setAutoTone(key as any)"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <!-- Toggle switch -->
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

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
    </div>

    <!-- Review cards -->
    <div v-else class="space-y-5">
      <div
        v-for="review in reviews"
        :key="review.id"
        class="border border-border rounded-2xl bg-white overflow-hidden"
        :class="review.replied ? 'opacity-60' : ''"
      >
        <!-- Review header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-surface-warm flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-text-muted">{{ review.reviewer_name.charAt(0) }}</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-text-primary">{{ review.reviewer_name }}</p>
                <span v-if="review.replied" class="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-full">Replied</span>
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <StarRating :rating="review.rating" />
                <span class="text-[10px] text-text-muted">{{ review.posted_at }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Review text -->
        <div class="px-6 pt-3 pb-5">
          <p class="text-sm text-text-secondary leading-relaxed">"{{ review.review_text }}"</p>
        </div>

        <!-- Response section -->
        <div v-if="!review.replied" class="border-t border-border-subtle">
          <!-- Tone tabs -->
          <div class="flex px-6 gap-0 border-b border-border-subtle">
            <button
              v-for="(label, key) in toneLabels"
              :key="key"
              class="relative px-4 py-3 text-xs font-semibold transition-colors duration-200"
              :class="activeTab[review.id] === key
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'"
              @click="selectTone(review.id, key)"
            >
              {{ label }}
              <span
                v-if="activeTab[review.id] === key"
                class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
              />
            </button>
          </div>

          <!-- Editable response -->
          <div class="px-6 pt-4 pb-5 bg-surface-warm/30">
            <textarea
              v-model="editedText[review.id]"
              rows="4"
              class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 resize-none leading-relaxed"
            />

            <div class="flex items-center justify-between mt-3">
              <p class="text-[10px] text-text-muted">Edit the response above before sending, or send as-is.</p>
              <button
                class="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                :class="sentIds.has(review.id)
                  ? 'bg-success/10 text-success'
                  : 'bg-accent text-white hover:bg-accent-hover'"
                :disabled="sendingId === review.id || sentIds.has(review.id)"
                @click="sendReply(review.id)"
              >
                <Loader2 v-if="sendingId === review.id" class="w-3.5 h-3.5 animate-spin" />
                <Check v-else-if="sentIds.has(review.id)" class="w-3.5 h-3.5" />
                <Send v-else class="w-3.5 h-3.5" />
                {{ sendingId === review.id ? 'Posting...' : sentIds.has(review.id) ? 'Posted' : 'Post Reply' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
