<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { config } from '@/config/env'
import { openCheckout, waitForPaddle } from '@/services/paddle.service'
import FooterSection from '@/components/layout/FooterSection.vue'
import PricingCard from '@/components/pricing/PricingCard.vue'
import { Shield, RotateCcw, Eye } from 'lucide-vue-next'
import { useReveal } from '@/utils/useReveal'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

useReveal()

const router = useRouter()
const auth = useAuthStore()

const PENDING_KEY = 'cw_pending_checkout'

onMounted(async () => {
  const pending = localStorage.getItem(PENDING_KEY)
  if (pending && auth.isAuthenticated) {
    localStorage.removeItem(PENDING_KEY)
    try {
      await waitForPaddle()
      openCheckout(pending)
    } catch {
      // paddle didn't load — ignore, user can click manually
    }
  }
})

const isAnnual = ref(true)

const plans = computed(() => [
  {
    name: 'Starter',
    priceMonthly: 29,
    priceAnnual: 24,
    features: [
      'Up to 50 reviews/month',
      '3 AI response options per review',
      'Google Business Profile integration',
      'Email notifications',
      'Standard support',
    ],
    highlighted: false,
    paddlePriceMonthly: config.paddle.prices.starterMonthly,
    paddlePriceAnnual: config.paddle.prices.starterAnnual,
  },
  {
    name: 'Growth',
    priceMonthly: 79,
    priceAnnual: 66,
    features: [
      'Up to 200 reviews/month',
      '3 AI response options per review',
      'Auto-post best response',
      'Sentiment analytics dashboard',
      'Priority support',
      'Custom brand voice training',
    ],
    highlighted: true,
    paddlePriceMonthly: config.paddle.prices.growthMonthly,
    paddlePriceAnnual: config.paddle.prices.growthAnnual,
  },
  {
    name: 'Scale',
    priceMonthly: 149,
    priceAnnual: 124,
    features: [
      'Unlimited reviews',
      '3 AI response options per review',
      'Auto-post with approval workflow',
      'Advanced analytics & reporting',
      'Multi-location support',
      'Dedicated account manager',
      'API access',
    ],
    highlighted: false,
    paddlePriceMonthly: config.paddle.prices.scaleMonthly,
    paddlePriceAnnual: config.paddle.prices.scaleAnnual,
  },
])

function handleSelect(plan: typeof plans.value[number]) {
  const priceId = isAnnual.value ? plan.paddlePriceAnnual : plan.paddlePriceMonthly
  if (!priceId) return

  if (!auth.isAuthenticated) {
    localStorage.setItem(PENDING_KEY, priceId)
    void router.push('/auth')
    return
  }

  openCheckout(priceId)
}

const faq = [
  {
    q: 'Will AI responses sound robotic or generic?',
    a: 'No. CredWave uses your restaurant\'s name, context, and the specific review content to craft responses that sound like you wrote them. You also get three tone options (Empathetic, Professional, Casual) per review, and you can edit any response before posting.',
  },
  {
    q: 'What if the AI writes something wrong or inappropriate?',
    a: 'Every response is shown to you before it goes live. You review, edit if needed, and approve. With auto-reply enabled, responses are still generated within the guardrails you set — your brand voice, custom instructions, and tone preference. You stay in control.',
  },
  {
    q: 'Do I need to give you access to my Google account?',
    a: 'You sign in with Google and grant access to your Google Business Profile — that\'s it. We only request the permissions needed to read your reviews and post responses. We never access your email, contacts, or anything else.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'You keep access until the end of your billing period. No penalties, no exit fees. Your data stays available for 30 days after cancellation in case you change your mind. Cancel in one click from your dashboard.',
  },
  {
    q: 'Is there a contract or long-term commitment?',
    a: 'No contracts. Monthly plans are month-to-month. Annual plans are paid upfront for the year at a 17% discount, but you can still cancel anytime — you\'ll just keep access through the end of the paid period.',
  },
  {
    q: 'How fast do responses get generated?',
    a: 'Typically under 10 seconds per review. With auto-reply enabled, new reviews are detected and responses are generated within minutes of the review being posted on Google.',
  },
  {
    q: 'What if I have multiple restaurant locations?',
    a: 'The Scale plan supports multiple locations under one account. Each location gets its own review feed, brand voice settings, and response history. Starter and Growth plans cover a single location.',
  },
  {
    q: 'Can I try it before paying?',
    a: 'Yes. Every plan includes a 14-day free trial with full access — no credit card required to start. You can also try the live demo on our site right now to see the quality of AI responses before signing up.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-surface-warm flex flex-col">

    <main class="pt-14 flex-1">
      <section class="py-24 px-6">
        <div class="max-w-[1200px] mx-auto">
          <div class="reveal text-center mb-14">
            <h1 class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-text-primary">
              Spend $24/mo to stop losing $2,400/mo
            </h1>
            <p class="mt-3 text-text-secondary max-w-[480px] mx-auto text-lg">
              Start free for 14 days. No credit card required. Cancel in one click.
            </p>

            <!-- Toggle -->
            <div class="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-border bg-white shadow-sm">
              <button
                class="px-5 py-2 text-sm font-medium rounded-full transition-all duration-300"
                :class="!isAnnual ? 'bg-brand text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
                @click="isAnnual = false"
              >
                Monthly
              </button>
              <button
                class="px-5 py-2 text-sm font-medium rounded-full transition-all duration-300"
                :class="isAnnual ? 'bg-brand text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
                @click="isAnnual = true"
              >
                Annual
                <span class="ml-1 text-[10px] font-bold" :class="isAnnual ? 'text-indigo-200' : 'text-accent'">–17%</span>
              </button>
            </div>
          </div>

          <!-- Cards -->
          <div class="reveal grid md:grid-cols-3 gap-6 max-w-[960px] mx-auto">
            <PricingCard
              v-for="plan in plans"
              :key="plan.name"
              :name="plan.name"
              :price="isAnnual ? plan.priceAnnual : plan.priceMonthly"
              :period="isAnnual ? 'mo (billed annually)' : 'mo'"
              :features="plan.features"
              :highlighted="plan.highlighted"
              @select="handleSelect(plan)"
            />
          </div>

          <!-- Trust Signals -->
          <div class="reveal mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-text-muted">
            <div class="flex items-center gap-2">
              <Shield class="w-4 h-4" />
              <span>14-day free trial</span>
            </div>
            <div class="flex items-center gap-2">
              <RotateCcw class="w-4 h-4" />
              <span>Cancel anytime</span>
            </div>
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4" />
              <span>No hidden fees</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FAQ ═══ -->
      <section class="py-24 px-6 bg-white">
        <div class="max-w-[680px] mx-auto">
          <div class="reveal text-center mb-14">
            <h2 class="text-2xl md:text-3xl font-bold font-display tracking-tight text-text-primary">
              Questions before you start
            </h2>
          </div>

          <div class="reveal space-y-4">
            <details
              v-for="(item, i) in faq"
              :key="i"
              class="group border border-border-subtle rounded-xl bg-surface-warm overflow-hidden"
            >
              <summary class="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none">
                <span class="text-sm font-semibold text-text-primary pr-4">{{ item.q }}</span>
                <span class="shrink-0 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-text-muted transition-transform duration-200 group-open:rotate-45">
                  <span class="text-xs leading-none">+</span>
                </span>
              </summary>
              <div class="px-6 pb-5 text-sm text-text-secondary leading-relaxed">
                {{ item.a }}
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>

    <FooterSection />
  </div>
</template>
