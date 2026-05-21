<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import {
    Check,
    Copy,
    Loader2,
    RefreshCw,
    ExternalLink,
    Search,
    Star,
} from "lucide-vue-next";
import StarRating from "@/components/shared/StarRating.vue";
import { useUserStore } from "@/stores/user.store";
import { useReviewsStore } from "@/stores/reviews.store";
import { useDemoStore } from "@/stores/demo.store";
import type { ReviewResponses } from "@/stores/reviews.store";
import type { SearchResult } from "@/stores/demo.store";

const userStore = useUserStore();
const reviewsStore = useReviewsStore();
const demoStore = useDemoStore();

const toneLabels: Record<string, string> = {
    empathetic: "Empathetic",
    professional: "Professional",
    casual: "Casual",
};

const activeStatus = ref("all");
const activeTab = ref<Record<string, keyof ReviewResponses>>({});
const editedText = ref<Record<string, string>>({});
const copiedId = ref<string | null>(null);

// Onboarding state
const onboardingQuery = ref("");
const onboardingCreating = ref(false);

// Infinite scroll
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
    observer = new IntersectionObserver(
        ([entry]) => {
            if (
                entry.isIntersecting &&
                reviewsStore.hasMore &&
                !reviewsStore.loadingMore &&
                !reviewsStore.loading &&
                userStore.restaurantId
            ) {
                void reviewsStore.loadMore(userStore.restaurantId);
            }
        },
        { rootMargin: "200px" },
    );
    if (sentinelRef.value) observer.observe(sentinelRef.value);
});

onUnmounted(() => {
    observer?.disconnect();
    reviewsStore.stopPolling();
});

// Fetch when restaurant is ready
watch(
    () => userStore.restaurantId,
    (id) => {
        if (id) void reviewsStore.fetchReviews(id, 1, activeStatus.value);
    },
    { immediate: true },
);

// Re-observe sentinel when it mounts/changes
watch(sentinelRef, (el) => {
    if (el && observer) observer.observe(el);
});

// Auto-generate replies and initialise tone/text state when reviews arrive
watch(
    () => reviewsStore.reviews,
    (newReviews) => {
        for (const review of newReviews) {
            if (!review.replied && !review.responses && !reviewsStore.generating[review.id]) {
                void reviewsStore.generateReplies(review.id);
            }
            if (review.responses && !activeTab.value[review.id]) {
                const tone = userStore.autoReply.defaultTone;
                activeTab.value[review.id] = tone;
                editedText.value[review.id] = review.responses[tone];
            }
        }
    },
    { deep: true },
);

function selectTone(reviewId: string, tone: keyof ReviewResponses) {
    activeTab.value[reviewId] = tone;
    const review = reviewsStore.reviews.find((r) => r.id === reviewId);
    if (review?.responses) {
        editedText.value[reviewId] = review.responses[tone];
    }
}

async function handleCopy(reviewId: string) {
    const text = editedText.value[reviewId];
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copiedId.value = reviewId;
        setTimeout(() => {
            copiedId.value = null;
        }, 2000);
    } catch {
        // clipboard API unavailable
    }
}

async function handleMarkDone(reviewId: string) {
    const text = editedText.value[reviewId];
    if (!text?.trim()) return;
    await reviewsStore.markHandled(reviewId, text);
}

function setStatus(status: string) {
    activeStatus.value = status;
    if (userStore.restaurantId) {
        void reviewsStore.fetchReviews(userStore.restaurantId, 1, status);
    }
}

function handleSync() {
    const restId = userStore.restaurantId;
    if (restId) {
        void reviewsStore.syncReviews(restId).then(() => {
            void reviewsStore.fetchReviews(restId, 1, activeStatus.value);
        });
    }
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// Onboarding
async function handleOnboardingSearch() {
    const q = onboardingQuery.value.trim();
    if (!q) return;
    await demoStore.searchRestaurants(q);
}

async function handleSelectRestaurant(result: SearchResult) {
    onboardingCreating.value = true;
    try {
        await userStore.createRestaurant(
            result.google_place_id,
            result.name,
            result.location,
        );
        void reviewsStore.fetchReviews(
            userStore.restaurantId!,
            1,
            activeStatus.value,
        );
    } finally {
        onboardingCreating.value = false;
        demoStore.reset();
        onboardingQuery.value = "";
    }
}
</script>

<template>
    <div class="p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-xl font-bold font-display text-text-primary">
                    Reviews
                </h1>
                <p class="text-sm text-text-muted mt-0.5">
                    <span class="text-accent font-semibold">{{
                        reviewsStore.stats.pending
                    }}</span>
                    pending ·
                    <span class="text-success font-semibold">{{
                        reviewsStore.stats.replied
                    }}</span>
                    replied
                </p>
            </div>

            <button
                class="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border transition-all"
                :disabled="reviewsStore.loading"
                title="Refresh reviews"
                @click="handleSync"
            >
                <RefreshCw
                    class="w-4 h-4"
                    :class="reviewsStore.loading ? 'animate-spin' : ''"
                />
            </button>
        </div>

        <!-- Status filter tabs -->
        <div class="flex gap-1 mb-6 border-b border-border-subtle">
            <button
                v-for="s in ['all', 'pending', 'replied']"
                :key="s"
                class="relative px-4 py-2.5 text-xs font-semibold capitalize transition-colors"
                :class="
                    activeStatus === s
                        ? 'text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                "
                @click="setStatus(s)"
            >
                {{ s }}
                <span
                    v-if="activeStatus === s"
                    class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
                />
            </button>
        </div>

        <!-- Onboarding: no restaurant yet -->
        <div
            v-if="!userStore.loading && !userStore.restaurantId"
            class="max-w-lg mx-auto py-12"
        >
            <div class="text-center mb-8">
                <h2 class="text-lg font-bold font-display text-text-primary">
                    Find your restaurant
                </h2>
                <p class="text-sm text-text-muted mt-1">
                    Search for your restaurant on Google Maps to get started.
                </p>
            </div>

            <!-- Search box -->
            <div class="flex gap-2">
                <input
                    v-model="onboardingQuery"
                    type="text"
                    placeholder="e.g. Bella Napoli, New York"
                    :disabled="demoStore.loading"
                    class="flex-1 px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white disabled:opacity-50"
                    @keydown.enter="handleOnboardingSearch"
                />
                <button
                    class="px-5 py-3 text-sm font-semibold bg-brand text-white rounded-xl hover:bg-brand-subtle transition-all disabled:opacity-50 flex items-center gap-2"
                    :disabled="demoStore.loading || !onboardingQuery.trim()"
                    @click="handleOnboardingSearch"
                >
                    <Loader2
                        v-if="demoStore.loading"
                        class="w-4 h-4 animate-spin"
                    />
                    <Search v-else class="w-4 h-4" />
                    Search
                </button>
            </div>

            <!-- Search results -->
            <div
                v-if="demoStore.searchResults.length > 0"
                class="mt-4 space-y-2"
            >
                <button
                    v-for="result in demoStore.searchResults"
                    :key="result.google_place_id"
                    class="w-full text-left px-4 py-3 rounded-xl border border-border-subtle bg-white hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-50"
                    :disabled="onboardingCreating"
                    @click="handleSelectRestaurant(result)"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-semibold text-text-primary">
                                {{ result.name }}
                            </p>
                            <p class="text-xs text-text-muted mt-0.5">
                                {{ result.location }}
                            </p>
                        </div>
                        <div
                            class="flex items-center gap-1 text-xs text-text-muted shrink-0 ml-3"
                        >
                            <Star class="w-3 h-3 text-warning fill-warning" />
                            <span>{{ result.rating ?? "—" }}</span>
                        </div>
                    </div>
                </button>
            </div>

            <p
                v-if="demoStore.error"
                class="mt-3 text-sm text-error text-center"
            >
                Search failed. Please try again.
            </p>
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="reviewsStore.loading" class="flex justify-center py-20">
            <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
        </div>

        <!-- Syncing state -->
        <div
            v-else-if="reviewsStore.syncing && reviewsStore.reviews.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center gap-3"
        >
            <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
            <p class="text-sm text-text-muted">Fetching your reviews…</p>
        </div>

        <!-- Empty state -->
        <div
            v-else-if="
                reviewsStore.reviews.length === 0 && !reviewsStore.loading
            "
            class="flex flex-col items-center justify-center py-20 text-center"
        >
            <p class="text-sm text-text-muted">No reviews found.</p>
        </div>

        <!-- Review cards -->
        <div v-else class="space-y-5">
            <div
                v-for="review in reviewsStore.reviews"
                :key="review.id"
                class="border border-border rounded-2xl bg-white overflow-hidden"
                :class="review.replied ? 'opacity-60' : ''"
            >
                <!-- Review header -->
                <div class="flex items-center justify-between px-6 pt-5 pb-0">
                    <div class="flex items-center gap-3">
                        <div
                            class="w-9 h-9 rounded-full bg-surface-warm flex items-center justify-center shrink-0"
                        >
                            <span class="text-xs font-bold text-text-muted">
                                {{ (review.reviewerName || "?").charAt(0) }}
                            </span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <p
                                    class="text-sm font-semibold text-text-primary"
                                >
                                    {{ review.reviewerName }}
                                </p>
                                <span
                                    v-if="review.replied"
                                    class="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-full"
                                >
                                    Done
                                </span>
                            </div>
                            <div class="flex items-center gap-2 mt-0.5">
                                <StarRating :rating="review.rating" />
                                <span class="text-[10px] text-text-muted">{{
                                    formatDate(review.postedAt)
                                }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Review text -->
                <div class="px-6 pt-3 pb-5">
                    <p class="text-sm text-text-secondary leading-relaxed">
                        "{{ review.reviewText }}"
                    </p>
                </div>

                <!-- Response section — only for pending reviews -->
                <div
                    v-if="!review.replied"
                    class="border-t border-border-subtle"
                >
                    <!-- Generating replies -->
                    <div
                        v-if="!review.responses"
                        class="px-6 py-4 bg-surface-warm/30 flex items-center gap-2 text-text-muted"
                    >
                        <Loader2 class="w-3.5 h-3.5 animate-spin shrink-0" />
                        <p class="text-xs">Generating replies…</p>
                    </div>

                    <!-- Responses ready -->
                    <template v-else>
                        <!-- Tone tabs -->
                        <div
                            class="flex px-6 gap-0 border-b border-border-subtle"
                        >
                            <button
                                v-for="(label, key) in toneLabels"
                                :key="key"
                                class="relative px-4 py-3 text-xs font-semibold transition-colors duration-200"
                                :class="
                                    activeTab[review.id] === key
                                        ? 'text-text-primary'
                                        : 'text-text-muted hover:text-text-secondary'
                                "
                                @click="
                                    selectTone(
                                        review.id,
                                        key as keyof ReviewResponses,
                                    )
                                "
                            >
                                {{ label }}
                                <span
                                    v-if="activeTab[review.id] === key"
                                    class="absolute bottom-0 left-4 right-4 h-[2px] bg-brand rounded-full"
                                />
                            </button>
                        </div>

                        <div class="px-6 pt-4 pb-5 bg-surface-warm/30">
                            <textarea
                                v-model="editedText[review.id]"
                                rows="4"
                                class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 resize-none leading-relaxed"
                            />

                            <div class="flex items-center gap-2 mt-3">
                                <!-- Copy response -->
                                <button
                                    class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                                    :class="
                                        copiedId === review.id
                                            ? 'bg-success/10 text-success'
                                            : 'bg-brand text-white hover:bg-brand-subtle'
                                    "
                                    @click="handleCopy(review.id)"
                                >
                                    <Check
                                        v-if="copiedId === review.id"
                                        class="w-3.5 h-3.5"
                                    />
                                    <Copy v-else class="w-3.5 h-3.5" />
                                    {{
                                        copiedId === review.id
                                            ? "Copied!"
                                            : "Copy Response"
                                    }}
                                </button>

                                <!-- Reply on Google -->
                                <a
                                    v-if="review.link"
                                    :href="review.link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-all duration-200"
                                >
                                    <ExternalLink class="w-3.5 h-3.5" />
                                    Reply on Google
                                </a>

                                <!-- Mark as done -->
                                <button
                                    class="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-success/40 hover:bg-success/5 transition-all disabled:opacity-50"
                                    :disabled="
                                        reviewsStore.sending[review.id] ||
                                        !editedText[review.id]?.trim()
                                    "
                                    @click="handleMarkDone(review.id)"
                                >
                                    <Loader2
                                        v-if="reviewsStore.sending[review.id]"
                                        class="w-3.5 h-3.5 animate-spin"
                                    />
                                    <Check v-else class="w-3.5 h-3.5" />
                                    {{
                                        reviewsStore.sending[review.id]
                                            ? "Saving..."
                                            : "Mark as Done"
                                    }}
                                </button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Infinite scroll sentinel -->
            <div ref="sentinelRef" class="h-4" />

            <!-- Load more spinner -->
            <div
                v-if="reviewsStore.loadingMore"
                class="flex justify-center py-4"
            >
                <Loader2 class="w-4 h-4 animate-spin text-text-muted" />
            </div>

            <!-- End of list -->
            <p
                v-if="
                    !reviewsStore.hasMore &&
                    reviewsStore.reviews.length > 0 &&
                    !reviewsStore.loadingMore
                "
                class="text-center text-xs text-text-muted py-2"
            >
                You've seen all reviews.
            </p>
        </div>
    </div>
</template>
