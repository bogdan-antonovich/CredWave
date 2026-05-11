<script setup lang="ts">
import FooterSection from '@/components/layout/FooterSection.vue'
import { useHead } from '@unhead/vue'

useHead({
  title: 'Terms of Service — CredWave',
  meta: [
    { name: 'description', content: 'CredWave terms of service and user agreement.' },
    { property: 'og:image', content: 'https://credwave.app/meta.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ],
})

const updated = 'May 4, 2026'
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
      <h1 class="text-3xl font-bold font-display text-text-primary mb-2">Terms of Service</h1>
      <p class="text-sm text-text-muted mb-12">Last updated: {{ updated }}</p>

      <div class="prose-legal">

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or using CredWave ("Service"), you agree to be bound by these
            Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms
            form a binding legal agreement between you and CredWave.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            CredWave is a subscription-based software tool that connects to your Google Business
            Profile, syncs customer reviews, and helps you generate and post AI-assisted replies.
            The Service includes a public demo feature, a management dashboard, and billing
            management via Paddle.
          </p>
        </section>

        <section>
          <h2>3. Eligibility and Account Registration</h2>
          <p>
            You must be at least 18 years old and have a valid Google account to use CredWave.
            You are responsible for maintaining the confidentiality of your account and for all
            activity that occurs under it. You agree to notify us immediately of any unauthorised
            use at <a href="mailto:hello@credwave.com">hello@credwave.com</a>.
          </p>
          <p>
            By connecting your Google account, you authorise CredWave to access your Google
            Business Profile data (reviews, locations, account information) on your behalf using
            the permissions you grant during OAuth.
          </p>
        </section>

        <section>
          <h2>4. Subscriptions and Billing</h2>
          <p>
            Access to the full Service requires a paid subscription. Subscriptions are billed on
            a recurring basis (monthly or annual depending on your plan) and are processed by
            Paddle, our authorised reseller and merchant of record.
          </p>
          <p>
            By subscribing, you authorise Paddle to charge your payment method on a recurring
            basis until you cancel. You can manage or cancel your subscription at any time via
            the Billing section of your dashboard.
          </p>

          <h3>Refunds</h3>
          <p>
            Refunds are handled by Paddle in accordance with their refund policy. If you cancel
            within 14 days of your initial purchase and have not materially used the Service, you
            may request a full refund by contacting
            <a href="mailto:hello@credwave.com">hello@credwave.com</a>.
            After 14 days, subscriptions are non-refundable except where required by applicable law.
          </p>

          <h3>Price changes</h3>
          <p>
            We may change subscription prices with at least 30 days' notice by email. Continued
            use of the Service after the price change takes effect constitutes acceptance of the
            new price.
          </p>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service to post fake, misleading, or defamatory reviews or replies</li>
            <li>Violate Google's Terms of Service or API policies while using the Service</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
            <li>Use the Service to harass, abuse, or harm any person</li>
            <li>Share your account credentials with others or resell access to the Service</li>
            <li>Use automated scripts to access the Service in ways that exceed normal usage</li>
            <li>Circumvent any rate limits, access controls, or authentication mechanisms</li>
          </ul>
          <p>
            Violation of these terms may result in immediate suspension or termination of your
            account without refund.
          </p>
        </section>

        <section>
          <h2>6. AI-Generated Content</h2>
          <p>
            CredWave uses OpenAI's API to generate reply suggestions. AI-generated replies are
            suggestions only — you are responsible for reviewing any reply before posting it to
            your Google Business Profile.
          </p>
          <p>
            We do not guarantee the accuracy, appropriateness, or quality of AI-generated content.
            You assume full responsibility for any reply you publish to Google.
          </p>
        </section>

        <section>
          <h2>7. Intellectual Property</h2>
          <p>
            The CredWave software, design, trademarks, and content are owned by CredWave and
            protected by applicable intellectual property laws. Your subscription grants you a
            limited, non-exclusive, non-transferable licence to use the Service for your own
            business purposes.
          </p>
          <p>
            You retain ownership of your restaurant data and review content. By using the Service,
            you grant us a limited licence to process that content solely to provide the Service
            to you.
          </p>
        </section>

        <section>
          <h2>8. Third-Party Services</h2>
          <p>
            The Service integrates with Google, Paddle, OpenAI, PostHog, and SerpAPI. Your use of
            these integrations is also subject to their respective terms of service. CredWave is not
            responsible for the availability, accuracy, or conduct of any third-party service.
          </p>
        </section>

        <section>
          <h2>9. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, or that defects
            will be corrected. We do not warrant that reviews synced from Google will be complete
            or up to date, as this depends on Google's API availability and your account permissions.
          </p>
        </section>

        <section>
          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CREDWAVE SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS
            OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION
            WITH YOUR USE OF THE SERVICE.
          </p>
          <p>
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID TO CREDWAVE
            IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless CredWave from any claims, damages, losses, or
            expenses (including legal fees) arising from your use of the Service, your violation of
            these Terms, or your violation of any third party's rights.
          </p>
        </section>

        <section>
          <h2>12. Termination</h2>
          <p>
            You may cancel your account at any time via the Billing section of your dashboard.
            We reserve the right to suspend or terminate your account at any time for violation
            of these Terms, without refund.
          </p>
          <p>
            Upon termination, your access to the Service will cease. We will delete your data
            within 30 days of account closure, except where retention is required by law.
          </p>
        </section>

        <section>
          <h2>13. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes
            by email or via an in-app notice at least 14 days before the changes take effect.
            Continued use of the Service after that date constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by the laws of Georgia. Any disputes arising under these Terms
            shall be subject to the exclusive jurisdiction of the courts of Georgia. If you are a
            consumer in a jurisdiction that provides mandatory local consumer protections, those
            protections apply in addition to these Terms and are not waived by this clause.
          </p>
        </section>

        <section>
          <h2>15. Contact</h2>
          <p>
            Questions about these Terms? Email us at
            <a href="mailto:hello@credwave.com">hello@credwave.com</a>.
          </p>
        </section>

      </div>
    </main>

    <FooterSection />
  </div>
</template>

<style scoped>
@reference "../assets/main.css";

.prose-legal section {
  @apply mb-10;
}
.prose-legal h2 {
  @apply text-lg font-bold text-text-primary mb-3 mt-8;
}
.prose-legal h3 {
  @apply text-sm font-semibold text-text-primary mb-1.5 mt-4;
}
.prose-legal p {
  @apply text-sm text-text-secondary leading-relaxed mb-3;
}
.prose-legal ul {
  @apply text-sm text-text-secondary leading-relaxed mb-3 pl-5 space-y-1.5 list-disc;
}
.prose-legal a {
  @apply text-accent hover:underline;
}
</style>
