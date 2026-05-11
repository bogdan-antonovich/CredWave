<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
    Sparkles,
    Loader2,
    Send,
    Check,
    ExternalLink,
    Star,
} from "lucide-vue-next";

const REVIEW_TEXT =
    "Booked for our anniversary. Seated 40 minutes late, food arrived cold, and the manager we asked for never showed up. $160 and a ruined evening. Avoid.";

const REPLIES = [
    {
        key: "empathetic",
        label: "Empathetic",
        text: "David, we're heartbroken to read this — your anniversary deserved the exact opposite of what we delivered. A long wait, cold food, and a manager who never came is inexcusable. Please reach out to us directly. We want to make this right, genuinely.",
    },
    {
        key: "professional",
        label: "Professional",
        text: "Thank you for sharing this. A reservation delay, cold food, and an unacknowledged request for management is entirely unacceptable, and we sincerely apologise. We would welcome the opportunity to speak with you directly and address this properly.",
    },
    {
        key: "casual",
        label: "Casual",
        text: "An anniversary dinner ruined by a 40-min wait, cold food, and a no-show manager — that's completely on us and we're sorry. Please reach out, we'd really like to make it right 🙏",
    },
];

type Phase =
    | "idle"
    | "typing"
    | "pre-generate"
    | "loading"
    | "results"
    | "copying";

const sectionRef = ref<HTMLElement | null>(null);
const displayedText = ref("");
const phase = ref<Phase>("idle");
const activeTab = ref(0);
const copyDone = ref(false);

const hasResults = computed(
    () => phase.value === "results" || phase.value === "copying",
);

let animationId = 0;
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
let sectionObserver: IntersectionObserver | null = null;

function wait(ms: number, id: number): Promise<boolean> {
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(id === animationId), ms);
        pendingTimeouts.push(t);
    });
}

function cancelAnimation() {
    animationId++;
    pendingTimeouts.forEach(clearTimeout);
    pendingTimeouts.length = 0;
}

function resetState() {
    displayedText.value = "";
    phase.value = "idle";
    activeTab.value = 0;
    copyDone.value = false;
}

async function runAnimation() {
    cancelAnimation();
    resetState();
    const id = animationId;

    if (!(await wait(500, id))) return;

    phase.value = "typing";
    for (let i = 1; i <= REVIEW_TEXT.length; i++) {
        if (!(await wait(18, id))) return;
        displayedText.value = REVIEW_TEXT.slice(0, i);
    }

    if (!(await wait(500, id))) return;
    phase.value = "pre-generate";

    if (!(await wait(700, id))) return;
    phase.value = "loading";

    if (!(await wait(1700, id))) return;
    phase.value = "results";

    if (!(await wait(900, id))) return;
    phase.value = "copying";
    copyDone.value = true;

    if (!(await wait(12000, id))) return;

    resetState();
    await wait(400, id);
    void runAnimation();
}

onMounted(() => {
    sectionObserver = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) void runAnimation();
            else {
                cancelAnimation();
                resetState();
            }
        },
        { threshold: 0.2 },
    );
    if (sectionRef.value) sectionObserver.observe(sectionRef.value);
});

onUnmounted(() => {
    cancelAnimation();
    sectionObserver?.disconnect();
});
</script>

<template>
    <section
        ref="sectionRef"
        class="py-28 px-6"
        style="background: linear-gradient(180deg, #13111a 0%, #0f0f0f 100%)"
    >
        <div class="max-w-[1200px] mx-auto">
            <!-- Header -->
            <div class="reveal text-center mb-14">
                <p
                    class="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-3"
                >
                    How it works
                </p>
                <h2
                    class="text-3xl md:text-4xl font-bold font-display tracking-tight text-white"
                >
                    From new review to Google reply. In seconds.
                </h2>
                <p class="mt-3 text-white/40 max-w-[480px] mx-auto">
                    Watch CredWave turn a real review into three ready-to-post
                    replies — no editing required.
                </p>
            </div>

            <!-- Demo window -->
            <div class="max-w-[660px] mx-auto">
                <!-- Browser chrome -->
                <div
                    class="rounded-t-2xl bg-white/[0.04] border border-white/10 px-4 py-3 flex items-center gap-2"
                >
                    <div class="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div class="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    <div class="flex-1 mx-6">
                        <div
                            class="bg-white/5 rounded-md px-3 py-1 text-[11px] text-white/25 text-center font-mono tracking-wide"
                        >
                            dashboard.credwave.app
                        </div>
                    </div>
                </div>

                <!-- Dashboard bg -->
                <div
                    class="border border-t-0 border-white/10 rounded-b-2xl bg-white/[0.02] p-5"
                >
                    <!-- Review card -->
                    <div
                        class="border border-white/10 rounded-2xl bg-white/[0.05] overflow-hidden"
                    >
                        <!-- Review header -->
                        <div
                            class="flex items-center justify-between px-6 pt-5 pb-0"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0"
                                >
                                    <span
                                        class="text-xs font-bold text-white/60"
                                        >D</span
                                    >
                                </div>
                                <div>
                                    <p
                                        class="text-sm font-semibold text-white leading-tight"
                                    >
                                        David R.
                                    </p>
                                    <div class="flex gap-0.5 mt-0.5">
                                        <Star
                                            v-for="i in 5"
                                            :key="i"
                                            class="w-4 h-4"
                                            :class="
                                                i <= 2
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-white/15 fill-white/10'
                                            "
                                        />
                                    </div>
                                </div>
                            </div>
                            <span
                                class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/15 text-red-400"
                            >
                                Critical
                            </span>
                        </div>

                        <!-- Review text (typed) — fixed on mobile to prevent growth, natural on sm+ -->
                        <div class="px-6 pt-3 pb-5">
                            <div
                                class="h-24 sm:h-auto sm:min-h-[3rem] overflow-hidden"
                            >
                                <p
                                    class="text-sm text-white/55 leading-relaxed"
                                >
                                    <template v-if="displayedText"
                                        >"{{ displayedText
                                        }}<span
                                            v-if="phase === 'typing'"
                                            class="inline-block w-0.5 h-4 bg-white/55 ml-0.5 align-middle cursor-blink"
                                    /></template>
                                    <span
                                        v-else
                                        class="inline-block w-0.5 h-4 bg-white/55 align-middle cursor-blink opacity-40"
                                    />
                                </p>
                            </div>
                        </div>

                        <!-- Response section — always same structure, no height change -->
                        <div class="border-t border-white/[0.08]">
                            <!-- Tone tabs — always rendered, greyed until results -->
                            <div class="flex px-6 border-b border-white/[0.08]">
                                <button
                                    v-for="(reply, i) in REPLIES"
                                    :key="reply.key"
                                    class="relative px-4 py-3 text-xs font-semibold transition-colors duration-200"
                                    :class="
                                        hasResults && activeTab === i
                                            ? 'text-white'
                                            : hasResults
                                              ? 'text-white/35'
                                              : 'text-white/20'
                                    "
                                    @click="
                                        hasResults ? (activeTab = i) : undefined
                                    "
                                >
                                    {{ reply.label }}
                                    <span
                                        v-if="hasResults && activeTab === i"
                                        class="absolute bottom-0 left-4 right-4 h-[2px] bg-indigo-400 rounded-full"
                                    />
                                </button>
                            </div>

                            <!-- Content area -->
                            <div class="px-6 pt-4 pb-5 bg-white/[0.03]">
                                <!-- Reply box — taller on mobile where text wraps to more lines -->
                                <div
                                    class="relative h-36 sm:h-24 w-full border border-white/10 rounded-xl bg-white/[0.04] overflow-hidden"
                                >
                                    <!-- Idle / typing: faint placeholder lines -->
                                    <div
                                        v-if="
                                            !hasResults && phase !== 'loading'
                                        "
                                        class="absolute inset-0 px-4 py-3 flex flex-col justify-center gap-[9px]"
                                    >
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.07] w-11/12"
                                        />
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.07] w-full"
                                        />
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.07] w-7/12"
                                        />
                                    </div>

                                    <!-- Loading: pulsing skeleton -->
                                    <div
                                        v-else-if="phase === 'loading'"
                                        class="absolute inset-0 px-4 py-3 flex flex-col justify-center gap-[9px]"
                                    >
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.12] w-11/12 animate-pulse"
                                        />
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.12] w-full animate-pulse"
                                            style="animation-delay: 0.15s"
                                        />
                                        <div
                                            class="h-2.5 rounded-full bg-white/[0.12] w-7/12 animate-pulse"
                                            style="animation-delay: 0.3s"
                                        />
                                    </div>

                                    <!-- Results: real reply text -->
                                    <textarea
                                        v-else
                                        :value="REPLIES[activeTab].text"
                                        rows="3"
                                        readonly
                                        class="absolute inset-0 w-full h-full px-4 py-3 text-sm bg-transparent focus:outline-none resize-none leading-relaxed text-white/70"
                                    />
                                </div>

                                <!-- Footer — stacks vertically on mobile, side-by-side on sm+ -->
                                <div
                                    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3"
                                >
                                    <div
                                        class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2"
                                    >
                                        <p class="text-[10px] text-white/25">
                                            Edit before sending, or send as-is.
                                        </p>
                                        <a
                                            v-if="hasResults"
                                            class="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
                                        >
                                            <ExternalLink class="w-3 h-3" />
                                            View on Google
                                        </a>
                                    </div>

                                    <!-- Generate button -->
                                    <button
                                        v-if="!hasResults"
                                        class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 whitespace-nowrap self-start sm:self-auto"
                                        :class="
                                            phase === 'loading'
                                                ? 'bg-accent/60 text-white cursor-wait'
                                                : phase === 'pre-generate'
                                                  ? 'bg-accent text-white shadow-[0_0_16px_-2px_rgba(79,70,229,0.7)]'
                                                  : 'bg-accent/25 text-white/40'
                                        "
                                    >
                                        <Loader2
                                            v-if="phase === 'loading'"
                                            class="w-3.5 h-3.5 animate-spin"
                                        />
                                        <Sparkles v-else class="w-3.5 h-3.5" />
                                        {{
                                            phase === "loading"
                                                ? "Generating..."
                                                : "Generate Replies"
                                        }}
                                    </button>

                                    <!-- Post Reply button -->
                                    <button
                                        v-else
                                        class="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 whitespace-nowrap self-start sm:self-auto"
                                        :class="
                                            copyDone
                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                : 'bg-accent text-white'
                                        "
                                    >
                                        <Check
                                            v-if="copyDone"
                                            class="w-3.5 h-3.5"
                                        />
                                        <Send v-else class="w-3.5 h-3.5" />
                                        {{
                                            copyDone
                                                ? "Reply Posted!"
                                                : "Post Reply"
                                        }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Steps — vertical on mobile, horizontal on sm+ -->
            <div class="reveal mt-10 max-w-[660px] mx-auto">
                <div
                    class="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-8"
                >
                    <div
                        v-for="(step, i) in [
                            {
                                n: '1',
                                label: 'Connect Google Business Profile',
                            },
                            { n: '2', label: 'New review arrives' },
                            {
                                n: '3',
                                label: 'Pick a reply, post in one click',
                            },
                        ]"
                        :key="i"
                        class="flex items-center gap-3"
                    >
                        <span
                            class="w-8 h-8 rounded-full bg-accent/15 text-indigo-400 text-sm font-bold flex items-center justify-center shrink-0"
                        >
                            {{ step.n }}
                        </span>
                        <span class="text-sm text-white/70">{{
                            step.label
                        }}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
