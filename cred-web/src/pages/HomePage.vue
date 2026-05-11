<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import { RouterLink } from "vue-router";
import {
    MessageSquare,
    TrendingUp,
    Shield,
    Clock,
    Zap,
    Star,
} from "lucide-vue-next";
import FooterSection from "@/components/layout/FooterSection.vue";
import { useReveal } from "@/utils/useReveal";
import { useHead } from "@unhead/vue";

useReveal();
useHead({
    title: "CredWave — AI Google Review Management for Restaurants",
    meta: [
        {
            name: "description",
            content:
                "Restaurants that respond to every Google review earn 35% more. CredWave generates AI-written replies in 3 tones and posts them directly to Google — automatically.",
        },
    ],
});

const heroVisible = inject<Ref<boolean>>("heroVisible", ref(false));
const heroRef = ref<HTMLElement | null>(null);
let heroObserver: IntersectionObserver | null = null;

onMounted(() => {
    const el = heroRef.value;
    if (!el) return;
    heroObserver = new IntersectionObserver(
        ([entry]) => {
            heroVisible.value = entry.isIntersecting;
        },
        { threshold: 0 },
    );
    heroObserver.observe(el);
});

onUnmounted(() => {
    heroObserver?.disconnect();
    heroVisible.value = false;
});

const stats = [
    {
        value: "75%",
        label: "of restaurants never respond to a single online review",
    },
    {
        value: "5.1 days",
        label: "average restaurant review response time — among the worst of any industry",
    },
    {
        value: "3.73 ★",
        label: "average restaurant Google rating — among the lowest of any vertical",
    },
    {
        value: "88%",
        label: "of consumers choose a restaurant that replies to all its reviews",
    },
    {
        value: "47%",
        label: "would use a restaurant that ignores reviews entirely",
    },
    {
        value: "35%",
        label: "more revenue for restaurants that respond to at least 25% of reviews",
    },
    {
        value: "5–9%",
        label: "revenue increase per one-star improvement in Google rating",
    },
    {
        value: "91%",
        label: "of consumers reject restaurants rated below 4 stars",
    },
];
</script>

<template>
    <div class="min-h-screen overflow-hidden">
        <!-- ═══════ HERO ═══════ -->
        <section
            ref="heroRef"
            class="relative min-h-[92vh] flex items-center justify-center px-6 bg-surface-dark overflow-hidden"
        >
            <!-- Ambient drifting orbs -->
            <div
                class="absolute top-[40%] left-[45%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full bg-accent/6 blur-[140px] pointer-events-none drift-1"
            />
            <div
                class="absolute top-[25%] right-[8%] w-[350px] h-[350px] rounded-full bg-indigo-500/4 blur-[100px] pointer-events-none drift-2"
            />
            <div
                class="absolute bottom-[15%] left-[12%] w-[250px] h-[250px] rounded-full bg-violet-500/4 blur-[90px] pointer-events-none drift-3"
            />

            <div class="relative z-10 max-w-[760px] text-center">
                <h1
                    class="hero-enter hero-enter-delay-1 text-5xl md:text-[3.75rem] lg:text-7xl font-extrabold font-display leading-[1.05] tracking-tight text-white"
                >
                    Stop losing
                    <span
                        class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400"
                        >35% revenue</span
                    >
                    to unanswered reviews
                </h1>

                <p
                    class="hero-enter hero-enter-delay-2 mt-7 text-lg md:text-xl text-white/50 leading-relaxed max-w-[560px] mx-auto font-body"
                >
                    Restaurants that respond to every Google review earn 35%
                    more. CredWave writes perfect responses in seconds — so you
                    never miss one.
                </p>

                <div class="hero-enter hero-enter-delay-3 mt-10">
                    <RouterLink
                        to="/demo"
                        class="inline-flex items-center px-8 py-4 bg-accent text-white text-sm font-semibold rounded-full hover:bg-accent-hover transition-all duration-300 hover:scale-[1.03] hover:-translate-y-[1px] shadow-[0_0_40px_-8px_rgba(79,70,229,0.5)]"
                    >
                        See it in action
                    </RouterLink>
                </div>
            </div>
        </section>

        <!-- ═══════ SOCIAL PROOF STATS ═══════ -->
        <section
            class="py-24 px-6"
            style="
                background: linear-gradient(180deg, #0f0f0f 0%, #161418 100%);
            "
        >
            <div class="max-w-[1200px] mx-auto">
                <div class="reveal text-center mb-14">
                    <p
                        class="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-3"
                    >
                        The data is clear
                    </p>
                    <h2
                        class="text-3xl md:text-4xl font-bold font-display tracking-tight text-white"
                    >
                        Your reviews are making or breaking you
                    </h2>
                    <p class="mt-3 text-white/40 max-w-[480px] mx-auto">
                        These aren't opinions. These are the numbers that decide
                        whether a customer walks through your door — or your
                        competitor's.
                    </p>
                </div>
                <div class="reveal grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div
                        v-for="(stat, i) in stats"
                        :key="i"
                        class="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
                    >
                        <p
                            class="text-3xl md:text-4xl font-extrabold font-display text-indigo-400"
                        >
                            {{ stat.value }}
                        </p>
                        <p class="mt-2.5 text-sm text-white/40 leading-relaxed">
                            {{ stat.label }}
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ═══════ PROBLEM ═══════ -->
        <section class="py-28 px-6 bg-surface-warm">
            <div class="max-w-[880px] mx-auto">
                <div class="reveal text-center">
                    <span
                        class="inline-block px-3 py-1 rounded-full bg-red-50 text-error text-xs font-semibold uppercase tracking-wider mb-5"
                        >The problem</span
                    >
                    <h2
                        class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-text-primary leading-tight"
                    >
                        52% of customers expect a reply in 7 days.
                        <span class="text-error">You're not even close.</span>
                    </h2>
                    <p
                        class="mt-5 text-text-secondary leading-relaxed max-w-[600px] mx-auto text-lg"
                    >
                        You get 30+ reviews a month. Each one takes 10 minutes
                        to write a thoughtful reply. That's 5 hours you don't
                        have — so reviews pile up unanswered, and customers
                        walk.
                    </p>
                </div>

                <div class="reveal mt-16 grid md:grid-cols-3 gap-5">
                    <div
                        class="p-7 rounded-2xl bg-white border border-border-subtle"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4"
                        >
                            <Clock class="w-5 h-5 text-error" />
                        </div>
                        <p class="font-semibold text-text-primary mb-1.5">
                            5+ hours/week wasted
                        </p>
                        <p class="text-sm text-text-secondary leading-relaxed">
                            That's what it takes to manually craft responses to
                            every review. Time you could spend running your
                            restaurant.
                        </p>
                    </div>
                    <div
                        class="p-7 rounded-2xl bg-white border border-border-subtle"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4"
                        >
                            <Shield class="w-5 h-5 text-error" />
                        </div>
                        <p class="font-semibold text-text-primary mb-1.5">
                            91% judge you below 4 stars
                        </p>
                        <p class="text-sm text-text-secondary leading-relaxed">
                            One ignored bad review tanks your average — and 91%
                            of customers won't even consider you after that.
                        </p>
                    </div>
                    <div
                        class="p-7 rounded-2xl bg-white border border-border-subtle"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4"
                        >
                            <TrendingUp class="w-5 h-5 text-error" />
                        </div>
                        <p class="font-semibold text-text-primary mb-1.5">
                            35% revenue left on the table
                        </p>
                        <p class="text-sm text-text-secondary leading-relaxed">
                            Businesses that don't respond to reviews miss out on
                            35% more revenue. Every unanswered review is money
                            lost.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ═══════ SOLUTION ═══════ -->
        <section
            class="py-28 px-6 relative overflow-hidden"
            style="
                background: linear-gradient(180deg, #0f0f0f 0%, #13111a 100%);
            "
        >
            <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-accent/6 blur-[100px] pointer-events-none"
            />

            <div class="max-w-[880px] mx-auto relative z-10">
                <div class="reveal text-center">
                    <span
                        class="inline-block px-3 py-1 rounded-full bg-accent/10 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-5"
                        >The fix</span
                    >
                    <h2
                        class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-white leading-tight"
                    >
                        3 perfect responses to every review.
                        <span
                            class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400"
                            >In 5 seconds.</span
                        >
                    </h2>
                    <p
                        class="mt-5 text-white/45 leading-relaxed max-w-[580px] mx-auto text-lg"
                    >
                        Plug in your Google Business Profile. CredWave reads
                        every review, nails the sentiment, and writes three
                        on-brand responses — ready to post with one click.
                    </p>
                </div>

                <div class="reveal mt-16 grid md:grid-cols-3 gap-5">
                    <div
                        class="p-7 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4"
                        >
                            <MessageSquare class="w-5 h-5 text-indigo-400" />
                        </div>
                        <p class="font-semibold text-white mb-1.5">
                            Pick your tone, post in one click
                        </p>
                        <p class="text-sm text-white/40 leading-relaxed">
                            Empathetic, professional, or conversational — three
                            options, always on-brand, always ready.
                        </p>
                    </div>
                    <div
                        class="p-7 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4"
                        >
                            <TrendingUp class="w-5 h-5 text-indigo-400" />
                        </div>
                        <p class="font-semibold text-white mb-1.5">
                            16.4% more conversions
                        </p>
                        <p class="text-sm text-white/40 leading-relaxed">
                            Businesses with review responses convert 16.4%
                            better. Respond to all of them — automatically.
                        </p>
                    </div>
                    <div
                        class="p-7 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm"
                    >
                        <div
                            class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4"
                        >
                            <Zap class="w-5 h-5 text-indigo-400" />
                        </div>
                        <p class="font-semibold text-white mb-1.5">
                            Live in under 2 minutes
                        </p>
                        <p class="text-sm text-white/40 leading-relaxed">
                            Connect your Google Business Profile, configure your
                            brand voice, done. No training, no onboarding.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ═══════ FINAL CTA ═══════ -->
        <section class="py-28 px-6 bg-surface-warm relative overflow-hidden">
            <div
                class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full bg-accent/5 blur-[80px] pointer-events-none"
            />

            <div class="reveal max-w-[600px] mx-auto text-center relative z-10">
                <div class="inline-flex items-center gap-1.5 mb-6">
                    <Star class="w-4 h-4 text-warning fill-warning" />
                    <Star class="w-4 h-4 text-warning fill-warning" />
                    <Star class="w-4 h-4 text-warning fill-warning" />
                    <Star class="w-4 h-4 text-warning fill-warning" />
                    <Star class="w-4 h-4 text-warning fill-warning" />
                </div>
                <h2
                    class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-text-primary leading-tight"
                >
                    Still writing review replies by hand?
                </h2>
                <p class="mt-4 text-text-secondary text-lg">
                    14-day free trial. No credit card. Cancel anytime.
                </p>
                <div
                    class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
                >
                    <RouterLink
                        to="/pricing"
                        class="inline-flex items-center px-8 py-4 bg-brand text-text-inverse text-sm font-semibold rounded-full hover:bg-brand-subtle transition-all duration-300 hover:scale-[1.03] hover:-translate-y-[1px] shadow-xl shadow-brand/10"
                    >
                        Start free trial
                    </RouterLink>
                    <RouterLink
                        to="/demo"
                        class="inline-flex items-center px-8 py-4 text-sm font-semibold text-text-secondary rounded-full border border-border hover:border-brand hover:text-text-primary transition-all duration-300"
                    >
                        Try the demo first
                    </RouterLink>
                </div>
            </div>
        </section>

        <FooterSection />
    </div>
</template>
