<script setup lang="ts">
import { ref } from 'vue'
import { CreditCard, Download, ExternalLink, Check, AlertCircle } from 'lucide-vue-next'

// Mock billing data
const plan = ref({
  name: 'Growth',
  price: 66,
  period: 'annual',
  reviewsUsed: 142,
  reviewsLimit: 200,
  nextBilling: 'May 15, 2026',
  status: 'active' as 'active' | 'past_due' | 'canceled',
})

const paymentMethod = ref({
  brand: 'Visa',
  last4: '4242',
  expiry: '09/27',
})

const invoices = ref([
  { id: 'inv_001', date: 'Apr 1, 2026', amount: '$66.00', status: 'paid' },
  { id: 'inv_002', date: 'Mar 1, 2026', amount: '$66.00', status: 'paid' },
  { id: 'inv_003', date: 'Feb 1, 2026', amount: '$66.00', status: 'paid' },
  { id: 'inv_004', date: 'Jan 1, 2026', amount: '$66.00', status: 'paid' },
  { id: 'inv_005', date: 'Dec 1, 2025', amount: '$79.00', status: 'paid' },
])

const usagePercent = Math.round((plan.value.reviewsUsed / plan.value.reviewsLimit) * 100)

function manageBilling() {
  // TODO: Open Paddle customer portal
  // window.Paddle.Checkout.open(...)
  alert('This will open the Paddle customer portal in production.')
}
</script>

<template>
  <div class="p-8 max-w-[720px]">
    <div class="mb-8">
      <h1 class="text-xl font-bold font-display text-text-primary">Billing</h1>
      <p class="text-sm text-text-muted mt-0.5">Manage your subscription, payment method, and invoices.</p>
    </div>

    <div class="space-y-6">
      <!-- ═══ Current Plan ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl overflow-hidden">
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold font-display text-text-primary">{{ plan.name }}</h2>
                <span
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="plan.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
                >
                  {{ plan.status === 'active' ? 'Active' : plan.status === 'past_due' ? 'Past Due' : 'Canceled' }}
                </span>
              </div>
              <p class="text-sm text-text-muted mt-1">
                <span class="text-2xl font-bold font-display text-text-primary">${{ plan.price }}</span>
                /mo billed {{ plan.period }}ly
              </p>
              <p class="text-xs text-text-muted mt-2">Next billing date: {{ plan.nextBilling }}</p>
            </div>
            <button
              class="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all"
              @click="manageBilling"
            >
              Change Plan
            </button>
          </div>
        </div>

        <!-- Usage bar -->
        <div class="px-6 pb-6">
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-text-muted">Reviews this month</span>
            <span class="font-semibold text-text-primary">{{ plan.reviewsUsed }} / {{ plan.reviewsLimit }}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-surface-warm overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="usagePercent > 90 ? 'bg-error' : usagePercent > 70 ? 'bg-warning' : 'bg-accent'"
              :style="{ width: `${usagePercent}%` }"
            />
          </div>
          <div v-if="usagePercent > 90" class="flex items-center gap-1.5 mt-2">
            <AlertCircle class="w-3.5 h-3.5 text-warning" />
            <p class="text-xs text-warning font-medium">Approaching your review limit. Consider upgrading.</p>
          </div>
        </div>
      </section>

      <!-- ═══ Payment Method ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl p-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-text-primary mb-3">Payment Method</h2>
            <div class="flex items-center gap-3">
              <div class="w-10 h-7 rounded bg-surface-warm border border-border-subtle flex items-center justify-center">
                <CreditCard class="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <p class="text-sm font-medium text-text-primary">{{ paymentMethod.brand }} •••• {{ paymentMethod.last4 }}</p>
                <p class="text-xs text-text-muted">Expires {{ paymentMethod.expiry }}</p>
              </div>
            </div>
          </div>
          <button
            class="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all"
            @click="manageBilling"
          >
            Update
          </button>
        </div>
      </section>

      <!-- ═══ Invoices ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-border-subtle">
          <h2 class="text-sm font-bold text-text-primary">Invoice History</h2>
        </div>

        <div class="divide-y divide-border-subtle">
          <div
            v-for="invoice in invoices"
            :key="invoice.id"
            class="flex items-center justify-between px-6 py-3 hover:bg-surface-warm/30 transition-colors"
          >
            <div class="flex items-center gap-4">
              <p class="text-sm text-text-primary w-28">{{ invoice.date }}</p>
              <p class="text-sm font-medium text-text-primary">{{ invoice.amount }}</p>
              <span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                <Check class="w-3 h-3" />
                {{ invoice.status }}
              </span>
            </div>
            <button class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-warm transition-all" title="Download invoice">
              <Download class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <!-- Manage externally -->
      <div class="text-center">
        <button
          class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
          @click="manageBilling"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          Manage subscription via Paddle
        </button>
      </div>
    </div>
  </div>
</template>
