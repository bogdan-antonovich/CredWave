<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CreditCard, Download, ExternalLink, Check, AlertCircle, Loader2, Tag, ChevronDown, X } from 'lucide-vue-next'
import { useBillingStore } from '@/stores/billing.store'
import { config } from '@/config/env'

const billingStore = useBillingStore()

onMounted(() => void billingStore.fetchAll())

const showPlanPicker = ref(false)
const changePlanError = ref('')
const showCancelModal = ref(false)
const cancelError = ref('')

const usagePercent = computed(() => {
  const usage = billingStore.subscription?.usage
  if (!usage || usage.reviewsLimit === 0) return 0
  return Math.round((usage.reviewsUsed / usage.reviewsLimit) * 100)
})

// Price is stored in cents; for annual plans show the monthly equivalent.
const displayPrice = computed(() => {
  const price = billingStore.subscription?.plan.price ?? 0
  const period = billingStore.subscription?.plan.period
  const dollars = price / 100
  return Math.round(period === 'year' ? dollars / 12 : dollars)
})

const displayPeriodLabel = computed(() => {
  const period = billingStore.subscription?.plan.period
  return period === 'year' ? '/mo billed annually' : '/mo'
})

// Plans available for switching — same billing period as current subscription.
const availablePlans = computed(() => {
  const period = billingStore.subscription?.plan.period ?? 'month'
  const currentPlanName = billingStore.subscription?.plan.name?.toLowerCase()
  return [
    {
      name: 'starter',
      label: 'Starter',
      priceDisplay: period === 'year' ? 9 : 11,
      limit: 30,
      priceId: period === 'year' ? config.paddle.prices.starterAnnual : config.paddle.prices.starterMonthly,
      isCurrent: currentPlanName === 'starter',
    },
    {
      name: 'growth',
      label: 'Growth',
      priceDisplay: period === 'year' ? 19 : 23,
      limit: 100,
      priceId: period === 'year' ? config.paddle.prices.growthAnnual : config.paddle.prices.growthMonthly,
      isCurrent: currentPlanName === 'growth',
    },
    {
      name: 'scale',
      label: 'Scale',
      priceDisplay: period === 'year' ? 49 : 59,
      limit: 300,
      priceId: period === 'year' ? config.paddle.prices.scaleAnnual : config.paddle.prices.scaleMonthly,
      isCurrent: currentPlanName === 'scale',
    },
  ]
})

async function selectPlan(plan: (typeof availablePlans.value)[number]) {
  if (plan.isCurrent || billingStore.changePlanLoading) return
  changePlanError.value = ''
  try {
    await billingStore.changePlan(plan.priceId, plan.name)
    showPlanPicker.value = false
  } catch {
    changePlanError.value = 'Failed to change plan. Please try again or contact support.'
  }
}

async function handleCancel() {
  cancelError.value = ''
  try {
    await billingStore.cancelSubscription()
    showCancelModal.value = false
  } catch {
    cancelError.value = 'Failed to cancel. Please try again or contact support.'
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
}

function statusLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'trialing') return 'Trial'
  if (status === 'past_due') return 'Past Due'
  if (status === 'canceled') return 'Canceled'
  return status
}
</script>

<template>
  <div class="p-8 max-w-[720px]">
    <div class="mb-8">
      <h1 class="text-xl font-bold font-display text-text-primary">Billing</h1>
      <p class="text-sm text-text-muted mt-0.5">Manage your subscription, payment method, and invoices.</p>
    </div>

    <!-- Loading -->
    <div v-if="billingStore.loading" class="flex justify-center py-20">
      <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
    </div>

    <!-- No subscription -->
    <div v-else-if="!billingStore.hasSubscription" class="space-y-6">
      <div v-if="!billingStore.promoAccess" class="text-center py-20">
        <p class="text-sm text-text-muted">You don't have an active subscription yet.</p>
        <p class="text-xs text-text-muted mt-1">Choose a plan from the pricing page to get started.</p>
      </div>

      <!-- Promo-only user -->
      <section v-if="billingStore.promoAccess" class="bg-white border border-border-subtle rounded-2xl p-6">
        <div class="flex items-center gap-2 mb-4">
          <Tag class="w-4 h-4 text-accent" />
          <h2 class="text-sm font-bold text-text-primary">Promo Access</h2>
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm text-text-secondary">
              Code: <span class="font-mono font-semibold text-text-primary">{{ billingStore.promoAccess.code }}</span>
            </p>
            <p class="text-sm text-text-secondary">
              Expires: <span class="font-medium text-text-primary">{{ formatDate(billingStore.promoAccess.accessUntil) }}</span>
            </p>
            <p class="text-xs text-text-muted">
              {{ daysRemaining(billingStore.promoAccess.accessUntil) }} days remaining
            </p>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            Active
          </span>
        </div>
      </section>
    </div>

    <div v-else class="space-y-6">
      <!-- Promo banner inside subscription view -->
      <section v-if="billingStore.promoAccess" class="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Tag class="w-4 h-4 text-accent shrink-0" />
          <div>
            <p class="text-sm font-semibold text-text-primary">
              Promo code active: <span class="font-mono">{{ billingStore.promoAccess.code }}</span>
            </p>
            <p class="text-xs text-text-muted mt-0.5">
              Access via promo until {{ formatDate(billingStore.promoAccess.accessUntil) }} · {{ daysRemaining(billingStore.promoAccess.accessUntil) }} days remaining
            </p>
          </div>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent shrink-0">
          Active
        </span>
      </section>
      <!-- ═══ Canceled banner ═══ -->
      <div
        v-if="billingStore.subscription?.plan.status === 'canceled'"
        class="rounded-2xl border border-border-subtle bg-white overflow-hidden"
      >
        <div class="p-6">
          <p class="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Subscription canceled</p>
          <h2 class="text-lg font-bold font-display text-text-primary">We're sorry to see you go.</h2>
          <p class="text-sm text-text-secondary mt-1 leading-relaxed">
            You still have full access to CredWave until
            <span class="font-semibold text-text-primary">{{ formatDate(billingStore.subscription?.plan.nextBillingDate ?? null) }}</span>.
            Changed your mind? Reactivate in one click — your plan and settings are untouched.
          </p>
        </div>
        <div class="px-6 pb-6 flex items-center gap-3">
          <button
            class="px-5 py-2.5 text-sm font-semibold bg-brand text-white rounded-xl hover:bg-brand-subtle transition-all disabled:opacity-50 flex items-center gap-2"
            :disabled="billingStore.reactivateLoading"
            @click="billingStore.reactivateSubscription()"
          >
            <Loader2 v-if="billingStore.reactivateLoading" class="w-3.5 h-3.5 animate-spin" />
            Reactivate subscription
          </button>
          <a href="/pricing" class="text-sm text-text-muted hover:text-text-primary transition-colors">
            View plans
          </a>
        </div>
      </div>

      <!-- ═══ Past-due banner ═══ -->
      <div
        v-if="billingStore.subscription?.plan.status === 'past_due'"
        class="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/5 p-4"
      >
        <AlertCircle class="w-4 h-4 text-error mt-0.5 shrink-0" />
        <div class="flex-1">
          <p class="text-sm font-semibold text-error">Payment failed</p>
          <p class="text-xs text-text-secondary mt-0.5">
            We couldn't charge your card. Update your payment method to keep access.
          </p>
        </div>
        <button
          class="shrink-0 px-3 py-1.5 text-xs font-semibold bg-error text-white rounded-lg hover:bg-error/90 transition-all disabled:opacity-50"
          :disabled="billingStore.portalLoading"
          @click="billingStore.openPortal()"
        >
          Fix payment
        </button>
      </div>

      <!-- ═══ Current Plan ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl overflow-hidden">
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold font-display text-text-primary">
                  {{ billingStore.subscription?.plan.name }}
                </h2>
                <span
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-success/10 text-success': billingStore.subscription?.plan.status === 'active',
                    'bg-accent/10 text-accent': billingStore.subscription?.plan.status === 'trialing',
                    'bg-error/10 text-error': billingStore.subscription?.plan.status === 'past_due',
                    'bg-text-muted/10 text-text-muted': billingStore.subscription?.plan.status === 'canceled',
                  }"
                >
                  {{ statusLabel(billingStore.subscription?.plan.status ?? '') }}
                </span>
              </div>
              <p class="text-sm text-text-muted mt-1">
                <span class="text-2xl font-bold font-display text-text-primary">
                  ${{ displayPrice }}
                </span>
                {{ displayPeriodLabel }}
              </p>
              <p
                v-if="billingStore.subscription?.plan.status !== 'canceled'"
                class="text-xs text-text-muted mt-2"
              >
                Next billing date: {{ formatDate(billingStore.subscription?.plan.nextBillingDate ?? null) }}
              </p>
              <p
                v-else
                class="text-xs text-text-muted mt-2"
              >
                Access until: {{ formatDate(billingStore.subscription?.plan.nextBillingDate ?? null) }}
              </p>
            </div>
            <button
              class="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all"
              @click="showPlanPicker = !showPlanPicker; changePlanError = ''"
            >
              Change Plan
              <ChevronDown
                class="w-3.5 h-3.5 transition-transform duration-200"
                :class="showPlanPicker ? 'rotate-180' : ''"
              />
            </button>
          </div>
        </div>

        <!-- Plan picker -->
        <div v-if="showPlanPicker" class="px-6 pb-6 border-t border-border-subtle pt-4">
          <p class="text-xs text-text-muted mb-3">
            Switch to a different plan — you'll be charged or credited the prorated difference immediately.
          </p>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="plan in availablePlans"
              :key="plan.name"
              class="relative flex flex-col items-start p-3 rounded-xl border text-left transition-all"
              :class="plan.isCurrent
                ? 'border-accent bg-accent/5 cursor-default'
                : 'border-border hover:border-brand/40 hover:bg-surface-warm cursor-pointer disabled:opacity-50'"
              :disabled="billingStore.changePlanLoading"
              @click="selectPlan(plan)"
            >
              <span v-if="plan.isCurrent" class="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-accent">Current</span>
              <Loader2 v-if="billingStore.changePlanLoading && !plan.isCurrent" class="absolute top-2 right-2 w-3 h-3 animate-spin text-text-muted" />
              <p class="text-sm font-bold text-text-primary">{{ plan.label }}</p>
              <p class="text-xs text-text-muted mt-0.5">${{ plan.priceDisplay }}/mo</p>
              <p class="text-xs text-text-muted mt-0.5">{{ plan.limit }} replies/mo</p>
            </button>
          </div>
          <p v-if="changePlanError" class="mt-3 text-xs text-error">{{ changePlanError }}</p>
        </div>

        <!-- Usage bar -->
        <div class="px-6 pb-6">
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-text-muted">Reviews this month</span>
            <span class="font-semibold text-text-primary">
              {{ billingStore.subscription?.usage.reviewsUsed }} / {{ billingStore.subscription?.usage.reviewsLimit }}
            </span>
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
            <div v-if="billingStore.subscription?.paymentMethod" class="flex items-center gap-3">
              <div class="w-10 h-7 rounded bg-surface-warm border border-border-subtle flex items-center justify-center">
                <CreditCard class="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <p class="text-sm font-medium text-text-primary">
                  {{ billingStore.subscription.paymentMethod.brand }} ••••
                  {{ billingStore.subscription.paymentMethod.last4 }}
                </p>
                <p class="text-xs text-text-muted">Expires {{ billingStore.subscription.paymentMethod.expiry }}</p>
              </div>
            </div>
            <p v-else class="text-sm text-text-muted">No payment method on file.</p>
          </div>
          <button
            class="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all disabled:opacity-50"
            :disabled="billingStore.portalLoading"
            @click="billingStore.openPortal()"
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

        <div v-if="billingStore.invoices.length === 0" class="px-6 py-6 text-center">
          <p class="text-sm text-text-muted">No invoices yet.</p>
        </div>

        <div v-else class="divide-y divide-border-subtle">
          <div
            v-for="invoice in billingStore.invoices"
            :key="invoice.id"
            class="flex items-center justify-between px-6 py-3 hover:bg-surface-warm/30 transition-colors"
          >
            <div class="flex items-center gap-4">
              <p class="text-sm text-text-primary w-28">{{ formatDate(invoice.date) }}</p>
              <p class="text-sm font-medium text-text-primary">{{ formatAmount(invoice.amount, invoice.currency) }}</p>
              <span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                <Check class="w-3 h-3" />
                {{ invoice.status }}
              </span>
            </div>
            <button
              class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-warm transition-all disabled:opacity-40"
              title="Download invoice"
              :disabled="billingStore.downloadingInvoiceId === invoice.paddle_invoice_id"
              @click="billingStore.downloadInvoice(invoice.paddle_invoice_id)"
            >
              <Loader2 v-if="billingStore.downloadingInvoiceId === invoice.paddle_invoice_id" class="w-3.5 h-3.5 animate-spin" />
              <Download v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <!-- Manage externally / Cancel -->
      <div class="flex items-center justify-between">
        <button
          class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors disabled:opacity-50"
          :disabled="billingStore.portalLoading"
          @click="billingStore.openPortal()"
        >
          <Loader2 v-if="billingStore.portalLoading" class="w-3.5 h-3.5 animate-spin" />
          <ExternalLink v-else class="w-3.5 h-3.5" />
          Manage subscription via Paddle
        </button>

        <button
          v-if="billingStore.subscription?.plan.status !== 'canceled'"
          class="text-xs text-text-muted hover:text-error transition-colors"
          @click="showCancelModal = true"
        >
          Cancel subscription
        </button>
      </div>
    </div>
  </div>

  <!-- ═══ Cancel Subscription Modal ═══ -->
  <Teleport to="body">
    <div
      v-if="showCancelModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      @click.self="showCancelModal = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-text-primary">Cancel subscription?</h3>
            <p class="text-xs text-text-muted mt-1 leading-relaxed">
              You'll keep access until
              <span class="font-medium text-text-primary">{{ formatDate(billingStore.subscription?.plan.nextBillingDate ?? null) }}</span>.
              No refund is issued for the remaining period.
            </p>
          </div>
          <button class="text-text-muted hover:text-text-primary transition-colors ml-4 shrink-0" @click="showCancelModal = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p v-if="cancelError" class="text-xs text-error mb-3">{{ cancelError }}</p>

        <div class="flex gap-3">
          <button
            class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-secondary hover:bg-surface-warm transition-colors"
            @click="showCancelModal = false"
          >
            Keep subscription
          </button>
          <button
            class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-error text-white hover:bg-error/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="billingStore.cancelLoading"
            @click="handleCancel"
          >
            <Loader2 v-if="billingStore.cancelLoading" class="w-3.5 h-3.5 animate-spin" />
            Yes, cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
