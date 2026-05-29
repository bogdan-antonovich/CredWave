<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { config } from "@/config/env";
import { useHead } from "@unhead/vue";
import { useUserStore } from "@/stores/user.store";

useHead({
    title: "Pricing — CredWave",
    meta: [
        {
            name: "description",
            content:
                "Plans from 9/month — no contracts, cancel anytime. AI-powered Google review replies for restaurants.",
        },
        { property: "og:image", content: "https://credwave.app/meta.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
    ],
});
import { openCheckout, waitForPaddle } from "@/services/paddle.service";
import FooterSection from "@/components/layout/FooterSection.vue";
import PricingCard from "@/components/pricing/PricingCard.vue";
import { Shield, RotateCcw, Eye, CheckCircle2, Loader2 } from "lucide-vue-next";
import { useReveal } from "@/utils/useReveal";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.store";
import { api, ApiError } from "@/services/api";

useReveal();

const router = useRouter();
const auth = useAuthStore();
const user = useUserStore();

const PENDING_KEY = "cw_pending_checkout";
const PROMO_KEY = "cw_pending_promo";

// Promo state
const promoCode = ref("");
const promoState = ref<"idle" | "loading" | "success" | "error">("idle");
const promoError = ref("");

onMounted(async () => {
    // Resume pending Paddle checkout after auth
    const pendingRaw = localStorage.getItem(PENDING_KEY);
    if (pendingRaw && auth.isAuthenticated) {
        localStorage.removeItem(PENDING_KEY);
        try {
            const pending = JSON.parse(pendingRaw) as {
                priceId: string;
                planName: string;
            };
            await waitForPaddle();
            openCheckout(
                pending.priceId,
                user.id!,
                user.profile.email,
                pending.planName,
                buildDashboardSuccessUrl(),
            );
        } catch {
            // paddle didn't load or bad stored value — ignore, user can click manually
        }
    }

    // Auto-redeem pending promo code after auth
    const pendingPromo = localStorage.getItem(PROMO_KEY);
    if (pendingPromo && auth.isAuthenticated) {
        localStorage.removeItem(PROMO_KEY);
        promoCode.value = pendingPromo;
        await nextTick();
        await redeemCode(pendingPromo);
    }
});

async function redeemCode(code: string) {
    promoState.value = "loading";
    promoError.value = "";
    try {
        await api.post("/promo/redeem", { promoCode: code });
        promoState.value = "success";
        setTimeout(() => {
            if (config.dashboardUrl) {
                const target = new URL(`${config.dashboardUrl}/auth/callback`);
                target.searchParams.set("access_token", auth.accessToken!);
                target.searchParams.set("refresh_token", auth.refreshToken!);
                window.location.href = target.toString();
            } else {
                void router.push("/");
            }
        }, 2000);
    } catch (e) {
        promoState.value = "error";
        promoError.value =
            e instanceof ApiError && e.status === 400
                ? "This code is invalid, expired, or has already been used."
                : "Something went wrong. Please try again.";
    }
}

function handlePromoRedeem() {
    const code = promoCode.value.trim().toUpperCase();
    if (!code) return;

    if (!auth.isAuthenticated) {
        localStorage.setItem(PROMO_KEY, code);
        void router.push("/auth");
        return;
    }

    void redeemCode(code);
}

const isAnnual = ref(true);

const plans = computed(() => [
    {
        name: "Starter",
        priceMonthly: 11,
        priceAnnual: 9,
        features: [
            "30 AI-generated replies per month",
            "3 response tones — Empathetic, Professional & Casual",
            "Reply directly on Google",
            "Email alerts for new reviews",
            "Restaurant profile & context",
            "Standard support",
        ],
        highlighted: false,
        paddlePriceMonthly: config.paddle.prices.starterMonthly,
        paddlePriceAnnual: config.paddle.prices.starterAnnual,
    },
    {
        name: "Growth",
        priceMonthly: 23,
        priceAnnual: 19,
        features: [
            "100 AI-generated replies per month",
            "3 response tones — Empathetic, Professional & Casual",
            "Reply directly on Google",
            "Email alerts for new reviews",
            "Restaurant profile & context",
            "Priority support",
        ],
        highlighted: true,
        paddlePriceMonthly: config.paddle.prices.growthMonthly,
        paddlePriceAnnual: config.paddle.prices.growthAnnual,
    },
    {
        name: "Scale",
        priceMonthly: 59,
        priceAnnual: 49,
        features: [
            "300 AI-generated replies per month",
            "3 response tones — Empathetic, Professional & Casual",
            "Reply directly on Google",
            "Email alerts for new reviews",
            "Restaurant profile & context",
            "Priority support",
        ],
        highlighted: false,
        paddlePriceMonthly: config.paddle.prices.scaleMonthly,
        paddlePriceAnnual: config.paddle.prices.scaleAnnual,
    },
]);

function buildDashboardSuccessUrl(): string | undefined {
    if (!config.dashboardUrl || !auth.accessToken || !auth.refreshToken)
        return undefined;
    const target = new URL(`${config.dashboardUrl}/auth/callback`);
    target.searchParams.set("access_token", auth.accessToken);
    target.searchParams.set("refresh_token", auth.refreshToken);
    return target.toString();
}

function openAuthPopup(): Window | null {
    const w = 500, h = 620;
    const left = window.screenX + Math.round((window.outerWidth - w) / 2);
    const top = window.screenY + Math.round((window.outerHeight - h) / 2);
    return window.open(
        `${config.apiUrl}/auth/google`,
        "cw-google-auth",
        `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`,
    );
}

function handleSelect(plan: (typeof plans.value)[number]) {
    const priceId = isAnnual.value
        ? plan.paddlePriceAnnual
        : plan.paddlePriceMonthly;
    if (!priceId) return;

    const planName = plan.name.toLowerCase(); // 'starter' | 'growth' | 'scale'

    if (!auth.isAuthenticated) {
        const popup = openAuthPopup();

        if (!popup) {
            // Popup blocked — fall back to redirect flow
            localStorage.setItem(PENDING_KEY, JSON.stringify({ priceId, planName }));
            void router.push("/auth");
            return;
        }

        let pollInterval: ReturnType<typeof setInterval>;

        // The popup calls auth.setTokens() on credwave.app, which writes to
        // localStorage and fires a storage event here (same origin, different window).
        const handleStorage = async (e: StorageEvent) => {
            if (e.key !== "cw_access_token" || !e.newValue) return;
            clearInterval(pollInterval);
            window.removeEventListener("storage", handleStorage);

            const refresh = localStorage.getItem("cw_refresh_token") ?? "";
            auth.setTokens(e.newValue, refresh);
            await user.fetchAll();

            try {
                await waitForPaddle();
                openCheckout(priceId, user.id!, user.profile.email, planName, buildDashboardSuccessUrl());
            } catch {
                // Paddle timed out — user can click the plan again
            }
        };
        window.addEventListener("storage", handleStorage);

        // Clean up if the user closes the popup without completing auth
        pollInterval = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollInterval);
                window.removeEventListener("storage", handleStorage);
            }
        }, 500);
        return;
    }

    openCheckout(
        priceId,
        user.id!,
        user.profile.email,
        planName,
        buildDashboardSuccessUrl(),
    );
}

const faq = [
    {
        q: "Will AI responses sound robotic or generic?",
        a: "No. CredWave uses your restaurant's name, context, and the specific review content to craft responses that sound like you wrote them. You also get three tone options (Empathetic, Professional, Casual) per review, and you can edit any response before posting.",
    },
    {
        q: "What if the AI writes something wrong or inappropriate?",
        a: "Every response is shown to you before it goes live. You review, edit if needed, and approve. With auto-reply enabled, responses are still generated within the guardrails you set — your brand voice, custom instructions, and tone preference. You stay in control.",
    },
    {
        q: "Do I need to give you access to my Google account?",
        a: "You sign in with Google and grant access to your Google Business Profile — that's it. We only request the permissions needed to read your reviews and post responses. We never access your email, contacts, or anything else.",
    },
    {
        q: "What happens if I cancel?",
        a: "You keep access until the end of your billing period. No penalties, no exit fees. Your data stays available for 30 days after cancellation in case you change your mind. Cancel in one click from your dashboard.",
    },
    {
        q: "Is there a contract or long-term commitment?",
        a: "No contracts. Monthly plans are month-to-month. Annual plans are paid upfront for the year at a 17% discount, but you can still cancel anytime — you'll just keep access through the end of the paid period.",
    },
    {
        q: "How fast do responses get generated?",
        a: "Typically under 10 seconds per review. With auto-reply enabled, new reviews are detected and responses are generated within minutes of the review being posted on Google.",
    },
    {
        q: "What if I have multiple restaurant locations?",
        a: "The Scale plan supports multiple locations under one account. Each location gets its own review feed, brand voice settings, and response history. Starter and Growth plans cover a single location.",
    },
    {
        q: "Can I see the product before subscribing?",
        a: "Yes — try the live demo on our site right now. Enter any restaurant name and see the AI generate real responses to real reviews, no sign-up required. When you're ready, subscribe and start managing your own reviews immediately.",
    },
];
</script>

<template>
    <div class="min-h-screen bg-surface-warm flex flex-col">
        <main class="pt-14 flex-1">
            <section class="py-24 px-6">
                <div class="max-w-[1200px] mx-auto">
                    <div class="reveal text-center mb-14">
                        <h1
                            class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-text-primary"
                        >
                            Spend $19/mo to stop losing $1,900/mo
                        </h1>
                        <p
                            class="mt-3 text-text-secondary max-w-[480px] mx-auto text-lg"
                        >
                            No contracts. Cancel anytime.
                        </p>

                        <!-- Toggle -->
                        <div
                            class="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-border bg-white shadow-sm"
                        >
                            <button
                                class="px-5 py-2 text-sm font-medium rounded-full transition-all duration-300"
                                :class="
                                    !isAnnual
                                        ? 'bg-brand text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary'
                                "
                                @click="isAnnual = false"
                            >
                                Monthly
                            </button>
                            <button
                                class="px-5 py-2 text-sm font-medium rounded-full transition-all duration-300"
                                :class="
                                    isAnnual
                                        ? 'bg-brand text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary'
                                "
                                @click="isAnnual = true"
                            >
                                Annual
                                <span
                                    class="ml-1 text-[10px] font-bold"
                                    :class="
                                        isAnnual
                                            ? 'text-indigo-200'
                                            : 'text-accent'
                                    "
                                    >–17%</span
                                >
                            </button>
                        </div>
                    </div>

                    <!-- Cards -->
                    <div
                        class="reveal grid md:grid-cols-3 gap-6 max-w-[960px] mx-auto"
                    >
                        <PricingCard
                            v-for="plan in plans"
                            :key="plan.name"
                            :name="plan.name"
                            :price="
                                isAnnual ? plan.priceAnnual : plan.priceMonthly
                            "
                            :period="isAnnual ? 'mo (billed annually)' : 'mo'"
                            :features="plan.features"
                            :highlighted="plan.highlighted"
                            @select="handleSelect(plan)"
                        />
                    </div>

                    <!-- Trust Signals -->
                    <div
                        class="reveal mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-text-muted"
                    >
                        <div class="flex items-center gap-2">
                            <Shield class="w-4 h-4" />
                            <span>No contracts</span>
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

            <!-- ═══ PROMO CODE ═══ -->
            <section
                id="promo"
                class="py-20 px-6 border-t border-border-subtle"
            >
                <div class="max-w-[520px] mx-auto">
                    <div class="reveal text-center mb-8">
                        <span
                            class="inline-block px-3 py-1 rounded-full bg-accent/8 text-accent text-xs font-semibold uppercase tracking-wider mb-4"
                            >Promo code</span
                        >
                        <h2
                            class="text-2xl font-bold font-display tracking-tight text-text-primary"
                        >
                            Have a code? Use it here.
                        </h2>
                        <p class="mt-2 text-text-secondary">
                            Enter your code to unlock access — no credit card
                            needed.
                        </p>
                    </div>

                    <!-- Success -->
                    <div
                        v-if="promoState === 'success'"
                        class="reveal flex flex-col items-center gap-3 py-4"
                    >
                        <div
                            class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center"
                        >
                            <CheckCircle2 class="w-6 h-6 text-success" />
                        </div>
                        <p class="text-sm font-semibold text-text-primary">
                            Access unlocked!
                        </p>
                        <p class="text-sm text-text-secondary">
                            Taking you to your dashboard…
                        </p>
                        <Loader2
                            class="w-4 h-4 animate-spin text-text-muted mt-1"
                        />
                    </div>

                    <!-- Input -->
                    <div v-else class="reveal">
                        <div class="flex gap-2">
                            <input
                                v-model="promoCode"
                                type="text"
                                placeholder="Enter your code"
                                :disabled="promoState === 'loading'"
                                class="flex-1 px-4 py-3 text-sm font-mono uppercase border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white placeholder:normal-case placeholder:font-sans disabled:opacity-50"
                                @keydown.enter="handlePromoRedeem"
                            />
                            <button
                                class="px-6 py-3 text-sm font-semibold bg-brand text-white rounded-xl hover:bg-brand-subtle transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                :disabled="
                                    promoState === 'loading' ||
                                    !promoCode.trim()
                                "
                                @click="handlePromoRedeem"
                            >
                                <Loader2
                                    v-if="promoState === 'loading'"
                                    class="w-4 h-4 animate-spin"
                                />
                                {{
                                    promoState === "loading"
                                        ? "Redeeming…"
                                        : "Redeem"
                                }}
                            </button>
                        </div>
                        <p
                            v-if="promoState === 'error'"
                            class="mt-3 text-sm text-error text-center"
                        >
                            {{ promoError }}
                        </p>
                        <p
                            v-if="!auth.isAuthenticated"
                            class="mt-3 text-xs text-text-muted text-center"
                        >
                            You'll be asked to sign in first — your code will be
                            remembered.
                        </p>
                    </div>
                </div>
            </section>

            <!-- ═══ FAQ ═══ -->
            <section class="py-24 px-6 bg-white">
                <div class="max-w-[680px] mx-auto">
                    <div class="reveal text-center mb-14">
                        <h2
                            class="text-2xl md:text-3xl font-bold font-display tracking-tight text-text-primary"
                        >
                            Questions before you start
                        </h2>
                    </div>

                    <div class="reveal space-y-4">
                        <details
                            v-for="(item, i) in faq"
                            :key="i"
                            class="group border border-border-subtle rounded-xl bg-surface-warm overflow-hidden"
                        >
                            <summary
                                class="flex items-center justify-between px-6 py-4 cursor-pointer select-none list-none"
                            >
                                <span
                                    class="text-sm font-semibold text-text-primary pr-4"
                                    >{{ item.q }}</span
                                >
                                <span
                                    class="shrink-0 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-text-muted transition-transform duration-200 group-open:rotate-45"
                                >
                                    <span class="text-xs leading-none">+</span>
                                </span>
                            </summary>
                            <div
                                class="px-6 pb-5 text-sm text-text-secondary leading-relaxed"
                            >
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
