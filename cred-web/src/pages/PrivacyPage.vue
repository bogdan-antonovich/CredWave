<script setup lang="ts">
import FooterSection from "@/components/layout/FooterSection.vue";
import { useHead } from "@unhead/vue";

useHead({
    title: "Privacy Policy — CredWave",
    meta: [
        {
            name: "description",
            content: "How CredWave collects, uses, and protects your data.",
        },
        { property: "og:image", content: "https://credwave.app/meta.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
    ],
});

const updated = "May 4, 2026";
</script>

<template>
    <div class="min-h-screen bg-surface-warm">
        <header class="bg-white border-b border-border-subtle">
            <div
                class="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between"
            >
                <RouterLink to="/" class="flex items-center gap-2">
                    <span
                        class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white text-xs font-extrabold font-display tracking-tight leading-none"
                        >CW</span
                    >
                    <span
                        class="text-base font-bold tracking-tight text-text-primary font-display"
                        >CredWave</span
                    >
                </RouterLink>
            </div>
        </header>

        <main class="max-w-[760px] mx-auto px-6 py-16">
            <h1 class="text-3xl font-bold font-display text-text-primary mb-2">
                Privacy Policy
            </h1>
            <p class="text-sm text-text-muted mb-12">
                Last updated: {{ updated }}
            </p>

            <div class="prose-legal">
                <section>
                    <h2>1. Who We Are</h2>
                    <p>
                        CredWave ("we", "us", "our") is a software service
                        operated by CredWave. We provide AI-powered review
                        management tools for restaurants. Our contact email is
                        <a href="mailto:hello@credwave.app"
                            >hello@credwave.app</a
                        >.
                    </p>
                </section>

                <section>
                    <h2>2. What Data We Collect</h2>

                    <h3>Account data</h3>
                    <p>
                        When you sign in with Google, we receive your name,
                        email address, and profile picture from Google. We store
                        these to identify your account and display your profile
                        in the dashboard.
                    </p>

                    <h3>Restaurant data</h3>
                    <p>
                        We store the restaurant name, owner name, address, and
                        any additional context you provide in Settings. This
                        information is used to generate personalised AI replies.
                    </p>

                    <h3>Reviews</h3>
                    <p>
                        We sync reviews from your Google Business Profile via
                        the Google My Business API. Review text, ratings,
                        reviewer names, and reply history are stored in our
                        database so you can manage them in the dashboard.
                    </p>

                    <h3>Usage and analytics data</h3>
                    <p>
                        We use PostHog to understand how the product is used.
                        PostHog collects page views, feature interactions,
                        device type, browser, and approximate location
                        (country-level). No personally identifiable information
                        is included in analytics events beyond your internal
                        user ID.
                    </p>

                    <h3>Payment data</h3>
                    <p>
                        Payments are processed by Paddle. We do not store your
                        card number, expiry date, or CVV. We receive and store
                        subscription status, plan name, and invoice records from
                        Paddle after a transaction is completed.
                    </p>
                </section>

                <section>
                    <h2>3. How We Use Your Data</h2>
                    <ul>
                        <li>To provide and operate the CredWave service</li>
                        <li>
                            To sync your Google reviews and display them in the
                            dashboard
                        </li>
                        <li>
                            To generate AI reply suggestions — review text is
                            sent to OpenAI for this purpose
                        </li>
                        <li>To process subscription payments via Paddle</li>
                        <li>
                            To understand how the product is used and improve it
                            (PostHog analytics)
                        </li>
                        <li>
                            To respond to support requests sent via the contact
                            form
                        </li>
                    </ul>
                    <p>We do not sell your data to third parties.</p>
                </section>

                <section>
                    <h2>4. Third-Party Services</h2>
                    <p>
                        We share data with the following third parties as
                        necessary to operate the service:
                    </p>
                    <ul>
                        <li>
                            <strong>Google</strong> — OAuth authentication and
                            Google Business Profile API (review syncing and
                            posting replies)
                        </li>
                        <li>
                            <strong>Paddle</strong> — payment processing and
                            subscription management
                        </li>
                        <li>
                            <strong>OpenAI</strong> — AI reply generation.
                            Review text and restaurant context are sent to
                            OpenAI's API. OpenAI's data usage policy applies
                        </li>
                        <li>
                            <strong>PostHog</strong> — product analytics, hosted
                            on EU servers
                        </li>
                        <li>
                            <strong>SerpAPI</strong> — used in the public demo
                            feature to fetch sample reviews for a searched
                            restaurant. No account data is involved
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>5. Cookies</h2>
                    <p>
                        We use cookies and similar tracking technologies through
                        PostHog for analytics purposes. These cookies help us
                        understand how visitors interact with the product. You
                        can opt out of analytics cookies via the cookie banner
                        shown on your first visit, or at any time by contacting
                        us.
                    </p>
                    <p>
                        We do not use advertising cookies or sell cookie data to
                        any third party.
                    </p>
                </section>

                <section>
                    <h2>6. Data Retention</h2>
                    <p>
                        We retain your account data for as long as your account
                        is active. If you close your account, we delete your
                        personal data within 30 days, except where we are
                        required to retain it for legal or accounting purposes
                        (e.g. invoice records, which are kept for 7 years).
                    </p>
                </section>

                <section>
                    <h2>7. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li>Access the personal data we hold about you</li>
                        <li>Request correction of inaccurate data</li>
                        <li>
                            Request deletion of your account and associated data
                        </li>
                        <li>Object to or restrict certain processing</li>
                        <li>
                            Receive a copy of your data in a portable format
                        </li>
                    </ul>
                    <p>
                        To exercise any of these rights, email us at
                        <a href="mailto:hello@credwave.app"
                            >hello@credwave.app</a
                        >. We will respond within 30 days.
                    </p>
                </section>

                <section>
                    <h2>8. Data Security</h2>
                    <p>
                        We use industry-standard measures to protect your data,
                        including encrypted connections (HTTPS), hashed and
                        secret-managed credentials, and access controls. No
                        method of transmission over the internet is 100% secure,
                        and we cannot guarantee absolute security.
                    </p>
                </section>

                <section>
                    <h2>9. Children</h2>
                    <p>
                        CredWave is not directed at children under 16. We do not
                        knowingly collect personal data from anyone under 16. If
                        you believe a child has provided us with personal data,
                        contact us and we will delete it promptly.
                    </p>
                </section>

                <section>
                    <h2>10. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. We
                        will notify you of material changes by updating the
                        "Last updated" date at the top of this page. Continued
                        use of the service after changes are posted constitutes
                        your acceptance of the updated policy.
                    </p>
                </section>

                <section>
                    <h2>11. Contact</h2>
                    <p>
                        Questions about this Privacy Policy? Email us at
                        <a href="mailto:hello@credwave.app"
                            >hello@credwave.app</a
                        >.
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
