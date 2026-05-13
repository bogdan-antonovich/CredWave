<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { CreditCard, Download, ExternalLink, Check, AlertCircle, Loader2, Tag } from 'lucide-vue-next'
import { useBillingStore } from '@/stores/billing.store'

const billingStore = useBillingStore()

onMounted(() => void billingStore.fetchAll())

const usagePercent = computed(() => {
  const usage = billingStore.subscription?.usage
  if (!usage || usage.reviewsLimit === 0) return 0
  return Math.round((usage.reviewsUsed / usage.reviewsLimit) * 100)
})

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
                  :class="billingStore.subscription?.plan.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
                >
                  {{ statusLabel(billingStore.subscription?.plan.status ?? '') }}
                </span>
              </div>
              <p class="text-sm text-text-muted mt-1">
                <span class="text-2xl font-bold font-display text-text-primary">
                  ${{ billingStore.subscription?.plan.price }}
                </span>
                /mo billed {{ billingStore.subscription?.plan.period }}ly
              </p>
              <p class="text-xs text-text-muted mt-2">
                Next billing date: {{ formatDate(billingStore.subscription?.plan.nextBillingDate ?? null) }}
              </p>
            </div>
            <button
              class="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all disabled:opacity-50"
              :disabled="billingStore.portalLoading"
              @click="billingStore.openPortal()"
            >
              Change Plan
            </button>
          </div>
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

      <!-- Manage externally -->
      <div class="text-center">
        <button
          class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors disabled:opacity-50"
          :disabled="billingStore.portalLoading"
          @click="billingStore.openPortal()"
        >
          <Loader2 v-if="billingStore.portalLoading" class="w-3.5 h-3.5 animate-spin" />
          <ExternalLink v-else class="w-3.5 h-3.5" />
          Manage subscription via Paddle
        </button>
      </div>
    </div>
  </div>
</template>
