import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { track } from '@/services/analytics'

interface Plan {
  name: string
  price: number
  period: string
  status: 'active' | 'past_due' | 'canceled'
  nextBillingDate: string | null
  paddleSubscriptionId: string
}

interface Usage {
  reviewsUsed: number
  reviewsLimit: number
}

interface PaymentMethod {
  brand: string
  last4: string
  expiry: string
}

interface Subscription {
  plan: Plan
  usage: Usage
  paymentMethod: PaymentMethod | null
}

interface Invoice {
  id: string
  paddle_invoice_id: string
  date: string
  amount: number
  currency: string
  status: string
}

interface PromoAccess {
  code: string
  accessUntil: string
}

export const useBillingStore = defineStore('billing', () => {
  const subscription = ref<Subscription | null>(null)
  const invoices = ref<Invoice[]>([])
  const promoAccess = ref<PromoAccess | null>(null)
  const loading = ref(false)
  const portalLoading = ref(false)
  const hasSubscription = ref(true)
  const downloadingInvoiceId = ref<string | null>(null)

  async function fetchSubscription() {
    try {
      subscription.value = await api.get<Subscription>('/billing/subscription')
      hasSubscription.value = true
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        hasSubscription.value = false
      }
    }
  }

  async function fetchInvoices() {
    try {
      const data = await api.get<{ invoices: Invoice[] }>('/billing/invoices')
      invoices.value = data.invoices
    } catch {
      // no invoices or not subscribed
    }
  }

  async function fetchPromoAccess() {
    try {
      promoAccess.value = await api.get<PromoAccess>('/promo/access')
    } catch {
      promoAccess.value = null
    }
  }

  async function fetchAll() {
    loading.value = true
    await Promise.all([fetchSubscription(), fetchInvoices(), fetchPromoAccess()])
    loading.value = false
  }

  async function downloadInvoice(paddleInvoiceId: string) {
    downloadingInvoiceId.value = paddleInvoiceId
    try {
      const data = await api.get<{ url: string }>(`/billing/invoice/${paddleInvoiceId}`)
      window.open(data.url, '_blank')
    } finally {
      downloadingInvoiceId.value = null
    }
  }

  async function openPortal() {
    portalLoading.value = true
    try {
      const data = await api.post<{ url: string }>('/billing/portal')
      track('billing_portal_opened')
      window.open(data.url, '_blank')
    } finally {
      portalLoading.value = false
    }
  }

  return {
    subscription,
    invoices,
    promoAccess,
    loading,
    portalLoading,
    hasSubscription,
    downloadingInvoiceId,
    fetchAll,
    openPortal,
    downloadInvoice,
  }
})
