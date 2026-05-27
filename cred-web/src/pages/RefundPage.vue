<script setup lang="ts">
import FooterSection from '@/components/layout/FooterSection.vue'
import { useHead } from '@unhead/vue'

useHead({
  title: 'Refund Policy — CredWave',
  meta: [
    { name: 'description', content: 'CredWave refund and cancellation policy.' },
    { property: 'og:image', content: 'https://credwave.app/meta.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ],
})

const updated = 'May 22, 2026'
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <header class="bg-white border-b border-border-subtle">
      <div class="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white text-xs font-extrabold font-display tracking-tight leading-none">CW</span>
          <span class="text-base font-bold tracking-tight text-text-primary font-display">CredWave</span>
        </RouterLink>
      </div>
    </header>

    <main class="max-w-[760px] mx-auto px-6 py-16">
      <h1 class="text-3xl font-bold font-display text-text-primary mb-2">Refund Policy</h1>
      <p class="text-sm text-text-muted mb-12">Last updated: {{ updated }}</p>

      <div class="prose-legal">

        <section>
          <h2>1. Subscription Billing</h2>
          <p>
            CredWave offers monthly and annual subscription plans. Subscriptions are billed in advance
            and renew automatically at the end of each billing period unless cancelled.
          </p>
        </section>

        <section>
          <h2>2. Cancellations</h2>
          <p>
            You may cancel your subscription at any time from your account settings. Upon cancellation,
            your plan remains active until the end of the current billing period. No further charges
            will be made after that date.
          </p>
        </section>

        <section>
          <h2>3. Refunds</h2>
          <p>
            We offer a <strong>7-day money-back guarantee</strong> for new subscribers. If you are
            not satisfied with CredWave within the first 7 days of your initial subscription, contact
            us at <a href="mailto:hello@credwave.app">hello@credwave.app</a> and we will issue a full
            refund, no questions asked.
          </p>
          <p>
            Outside of the 7-day window, subscription fees are non-refundable. We do not issue
            partial refunds for unused time within a billing period.
          </p>
        </section>

        <section>
          <h2>4. Exceptions</h2>
          <p>
            We may issue refunds at our discretion in exceptional circumstances — for example, if a
            technical issue on our end prevented you from using the service for an extended period.
            Please reach out to us and we will review your case individually.
          </p>
        </section>

        <section>
          <h2>5. Annual Plans</h2>
          <p>
            Annual subscriptions cancelled within the first 7 days are eligible for a full refund.
            After 7 days, annual plans are non-refundable, but you will retain access to the service
            until the end of the annual period.
          </p>
        </section>

        <section>
          <h2>6. Contact Us</h2>
          <p>
            For any billing or refund questions, please contact us at
            <a href="mailto:hello@credwave.app">hello@credwave.app</a>.
            We typically respond within one business day.
          </p>
        </section>

      </div>
    </main>

    <FooterSection />
  </div>
</template>
