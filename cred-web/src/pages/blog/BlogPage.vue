<script setup lang="ts">
import { RouterLink } from 'vue-router'
import FooterSection from '@/components/layout/FooterSection.vue'
import { useHead } from '@unhead/vue'

useHead({
  title: 'Blog — CredWave',
  meta: [
    { name: 'description', content: 'Practical guides on Google review management, restaurant reputation, and getting more customers from your online presence.' },
    { property: 'og:image', content: 'https://credwave.app/meta.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ],
})

const articles = [
  {
    slug: '/blog/how-to-respond-to-negative-google-reviews',
    category: 'Review Responses',
    title: 'How to Respond to Negative Google Reviews',
    description: 'A bad review doesn\'t have to damage your reputation — your response is what most customers actually judge. A step-by-step framework with real examples.',
    date: 'January 15, 2026',
    readTime: '7 min',
  },
  {
    slug: '/blog/how-to-respond-to-positive-google-reviews',
    category: 'Review Responses',
    title: 'How to Respond to Positive Google Reviews',
    description: 'Most restaurants ignore five-star reviews entirely. Here\'s why that\'s a missed opportunity and how to respond in a way that builds loyalty.',
    date: 'January 22, 2026',
    readTime: '5 min',
  },
  {
    slug: '/blog/google-review-response-templates',
    category: 'Templates',
    title: 'Google Review Response Templates for Restaurants',
    description: 'Ready-to-use templates for negative, mixed, and positive reviews — organized by scenario. Copy, personalize, send.',
    date: 'February 3, 2026',
    readTime: '6 min',
  },
  {
    slug: '/blog/how-to-get-more-google-reviews',
    category: 'Getting Reviews',
    title: 'How to Get More Google Reviews for Your Restaurant',
    description: 'Review count is a direct Google local ranking factor. Here\'s exactly how to get a steady stream of real reviews — without violating Google\'s policies.',
    date: 'February 10, 2026',
    readTime: '6 min',
  },
  {
    slug: '/blog/why-respond-to-every-google-review',
    category: 'Strategy',
    title: 'Why Restaurants Should Respond to Every Google Review',
    description: 'The data is clear: businesses that respond consistently convert more customers and rank higher. Here\'s what the research actually says.',
    date: 'February 18, 2026',
    readTime: '5 min',
  },
  {
    slug: '/blog/how-to-deal-with-fake-google-reviews',
    category: 'Reputation',
    title: 'How to Deal with Fake Google Reviews',
    description: 'Fake reviews are a growing problem for restaurants. How to identify them, report them to Google, and protect your reputation while you wait.',
    date: 'March 5, 2026',
    readTime: '7 min',
  },
  {
    slug: '/blog/restaurant-reputation-management',
    category: 'Strategy',
    title: 'Restaurant Reputation Management: The Complete Guide',
    description: 'Your restaurant\'s online reputation directly affects revenue. This guide covers the full strategy — earning reviews, monitoring them, and responding effectively.',
    date: 'March 20, 2026',
    readTime: '9 min',
  },
]

const categoryColors: Record<string, string> = {
  'Review Responses': 'bg-indigo-50 text-indigo-700',
  'Templates': 'bg-emerald-50 text-emerald-700',
  'Getting Reviews': 'bg-amber-50 text-amber-700',
  'Strategy': 'bg-purple-50 text-purple-700',
  'Reputation': 'bg-rose-50 text-rose-700',
}
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <div class="pt-14">

      <section class="max-w-[1100px] mx-auto px-6 pt-16 pb-12">
        <p class="text-sm font-semibold text-accent uppercase tracking-widest mb-4">CredWave Blog</p>
        <h1 class="text-4xl sm:text-5xl font-bold font-display text-text-primary mb-5 leading-tight">
          Guides for restaurant owners
        </h1>
        <p class="text-lg text-text-secondary max-w-xl leading-relaxed">
          Practical advice on Google reviews, reputation management, and turning your online presence into more covers.
        </p>
      </section>

      <div class="h-px bg-border-subtle"></div>

      <section class="max-w-[1100px] mx-auto px-6 py-14">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <RouterLink
            v-for="article in articles"
            :key="article.slug"
            :to="article.slug"
            class="group bg-white rounded-2xl border border-border-subtle p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
          >
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-4"
              :class="categoryColors[article.category]"
            >{{ article.category }}</span>

            <h2 class="text-base font-bold font-display text-text-primary leading-snug mb-3 group-hover:text-accent transition-colors">
              {{ article.title }}
            </h2>

            <p class="text-sm text-text-muted leading-relaxed flex-1 mb-5">
              {{ article.description }}
            </p>

            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>{{ article.date }}</span>
              <span class="font-medium text-accent group-hover:underline">{{ article.readTime }} read →</span>
            </div>
          </RouterLink>
        </div>
      </section>

    </div>
    <FooterSection />
  </div>
</template>
