<script setup lang="ts">
import { ref, computed } from "vue";
import { Save, Loader2, Check, AlertTriangle, Unlink, ExternalLink, RefreshCw } from "lucide-vue-next";
import { useUserStore } from "@/stores/user.store";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "vue-router";

const userStore = useUserStore();
const authStore = useAuthStore();
const router = useRouter();

function handleChangeRestaurant() {
    userStore.changingRestaurant = true;
    void router.push({ name: "dashboard" });
}

const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);

// Google disconnect
const disconnecting = ref(false);
const disconnectError = ref<string | null>(null);

// Delete account modal
const showDeleteModal = ref(false);
const deleteEmail = ref("");
const deleting = ref(false);
const deleteError = ref<string | null>(null);
const deleteEmailMatches = computed(
    () => deleteEmail.value.trim() === userStore.profile.email,
);

const hasRestaurant = computed(() => !!userStore.restaurantId);

async function handleSave() {
    saving.value = true;
    saveError.value = null;
    try {
        await userStore.saveSettings();
        saved.value = true;
        setTimeout(() => {
            saved.value = false;
        }, 2000);
    } catch {
        saveError.value = "Failed to save. Please try again.";
    } finally {
        saving.value = false;
    }
}

async function handleDisconnectGoogle() {
    disconnecting.value = true;
    disconnectError.value = null;
    try {
        await userStore.disconnectGoogle();
    } catch {
        disconnectError.value = "Failed to disconnect. Please try again.";
    } finally {
        disconnecting.value = false;
    }
}

async function handleDeleteAccount() {
    if (!deleteEmailMatches.value) return;
    deleting.value = true;
    deleteError.value = null;
    try {
        await userStore.deleteAccount();
    } catch {
        deleteError.value = "Failed to delete account. Please try again.";
        deleting.value = false;
    }
}
</script>

<template>
    <div class="p-8 max-w-[720px]">
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-xl font-bold font-display text-text-primary">
                    Settings
                </h1>
                <p class="text-sm text-text-muted mt-0.5">
                    Manage your profile and restaurant.
                </p>
            </div>
            <button
                v-if="hasRestaurant"
                class="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                :class="
                    saved
                        ? 'bg-success/10 text-success'
                        : 'bg-brand text-white hover:bg-brand-subtle'
                "
                :disabled="saving"
                @click="handleSave"
            >
                <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                <Check v-else-if="saved" class="w-4 h-4" />
                <Save v-else class="w-4 h-4" />
                {{ saving ? "Saving..." : saved ? "Saved" : "Save Changes" }}
            </button>
        </div>

        <p v-if="saveError" class="text-xs text-error mb-4">{{ saveError }}</p>

        <div class="space-y-8">
            <!-- ═══ Profile ═══ -->
            <section
                class="bg-white border border-border-subtle rounded-2xl p-6"
            >
                <h2 class="text-sm font-bold text-text-primary mb-4">
                    Profile
                </h2>

                <div class="flex items-center gap-4 mb-5">
                    <div
                        class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center shrink-0"
                    >
                        <span class="text-lg font-bold text-accent">{{
                            (
                                userStore.restaurant.ownerName ||
                                userStore.profile.name ||
                                "?"
                            )
                                .charAt(0)
                                .toUpperCase()
                        }}</span>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-text-primary">
                            {{ userStore.restaurant.ownerName || userStore.profile.name }}
                        </p>
                        <p class="text-xs text-text-muted">
                            {{ userStore.profile.email }}
                        </p>
                        <p class="text-[10px] text-text-muted mt-0.5">
                            Managed via your Google account
                        </p>
                    </div>
                </div>

                <div>
                    <label
                        class="block text-xs font-medium text-text-secondary mb-1.5"
                        >Email</label
                    >
                    <input
                        :value="userStore.profile.email"
                        disabled
                        class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg bg-surface-warm text-text-muted cursor-not-allowed"
                    />
                    <p class="text-[10px] text-text-muted mt-1">
                        Email is linked to your Google account and cannot be
                        changed here.
                    </p>
                </div>
            </section>

            <!-- ═══ No restaurant banner ═══ -->
            <section
                v-if="!hasRestaurant"
                class="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4"
            >
                <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <p class="text-sm font-semibold text-amber-800">No restaurant connected</p>
                    <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                        CredWave couldn't find a Google Business Profile linked to your account.
                        Make sure your Google account has a verified Business Profile, then reconnect below.
                    </p>
                    <button
                        class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                        @click="authStore.login()"
                    >
                        Reconnect Google account
                    </button>
                </div>
            </section>

            <!-- ═══ Restaurant ═══ -->
            <section
                v-if="hasRestaurant"
                class="bg-white border border-border-subtle rounded-2xl p-6"
            >
                <h2 class="text-sm font-bold text-text-primary mb-4">
                    Restaurant
                </h2>

                <div class="space-y-4">
                    <div>
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Restaurant Name</label
                        >
                        <input
                            v-model="userStore.restaurant.name"
                            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Owner Name</label
                        >
                        <input
                            v-model="userStore.restaurant.ownerName"
                            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                    </div>

                    <div v-if="userStore.restaurant.googlePlaceId">
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Google Maps</label
                        >
                        <a
                            :href="`https://www.google.com/maps/place/?q=place_id:${userStore.restaurant.googlePlaceId}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                        >
                            <ExternalLink class="w-3.5 h-3.5" />
                            View on Google Maps
                        </a>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Change Restaurant</label
                        >
                        <button
                            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="!userStore.canChangeRestaurant"
                            @click="handleChangeRestaurant"
                        >
                            <RefreshCw class="w-3.5 h-3.5" />
                            Change Restaurant
                        </button>
                        <p
                            v-if="!userStore.canChangeRestaurant"
                            class="text-[10px] text-text-muted mt-1"
                        >
                            Available in {{ userStore.daysUntilCanChange }} day(s).
                        </p>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Additional Information</label
                        >
                        <textarea
                            v-model="userStore.restaurant.additionalInfo"
                            rows="5"
                            placeholder="Tell us about your restaurant — cuisine, vibe, history, anything that helps us write better responses..."
                            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none leading-relaxed"
                        />
                        <p class="text-[10px] text-text-muted mt-1">
                            This info helps our AI write more authentic,
                            on-brand responses.
                        </p>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-medium text-text-secondary mb-1.5"
                            >Custom Instructions (optional)</label
                        >
                        <textarea
                            v-model="userStore.autoReply.customInstructions"
                            rows="3"
                            placeholder="e.g. Always mention our weekend brunch special, avoid using emoji, sign off with the owner's first name..."
                            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none leading-relaxed"
                        />
                    </div>
                </div>
            </section>

            <!-- ═══ Google Account ═══ -->
            <section class="bg-white border border-border-subtle rounded-2xl p-6">
                <h2 class="text-sm font-bold text-text-primary mb-1">Google Account</h2>
                <p class="text-xs text-text-muted mb-4">
                    Disconnecting removes access to review sync and auto-reply. Your existing data is kept.
                </p>

                <div v-if="userStore.googleConnected">
                    <p v-if="disconnectError" class="text-xs text-error mb-3">{{ disconnectError }}</p>
                    <button
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-text-secondary hover:border-error/40 hover:text-error transition-all duration-200 disabled:opacity-50"
                        :disabled="disconnecting"
                        @click="handleDisconnectGoogle"
                    >
                        <Loader2 v-if="disconnecting" class="w-4 h-4 animate-spin" />
                        <Unlink v-else class="w-4 h-4" />
                        {{ disconnecting ? "Disconnecting..." : "Disconnect Google" }}
                    </button>
                </div>
                <div v-else class="flex items-center justify-between">
                    <p class="text-xs text-amber-600 font-medium">Google account disconnected — sync paused</p>
                    <button
                        class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-subtle transition-colors"
                        @click="authStore.login()"
                    >
                        Reconnect
                    </button>
                </div>
            </section>

            <!-- ═══ Danger Zone ═══ -->
            <section class="bg-white border border-error/20 rounded-2xl p-6">
                <h2 class="text-sm font-bold text-error mb-1">Danger Zone</h2>
                <p class="text-xs text-text-muted mb-4">
                    Permanently deletes your account, all restaurant data, reviews, and cancels your subscription. This cannot be undone.
                </p>
                <button
                    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-error/30 text-error hover:bg-error/5 transition-all duration-200"
                    @click="showDeleteModal = true"
                >
                    Delete Account
                </button>
            </section>
        </div>
    </div>

    <!-- ═══ Delete Account Modal ═══ -->
    <Teleport to="body">
        <div
            v-if="showDeleteModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            @click.self="showDeleteModal = false"
        >
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 class="text-base font-bold text-text-primary mb-1">Delete your account?</h3>
                <p class="text-xs text-text-muted mb-5 leading-relaxed">
                    This will permanently delete all your data and cancel your subscription immediately. To confirm, type your email address below.
                </p>

                <label class="block text-xs font-medium text-text-secondary mb-1.5">
                    Your email address
                </label>
                <input
                    v-model="deleteEmail"
                    type="email"
                    :placeholder="userStore.profile.email"
                    class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-error/20 focus:border-error transition-all mb-4"
                />

                <p v-if="deleteError" class="text-xs text-error mb-3">{{ deleteError }}</p>

                <div class="flex gap-3">
                    <button
                        class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-secondary hover:bg-surface-warm transition-colors"
                        @click="showDeleteModal = false"
                    >
                        Cancel
                    </button>
                    <button
                        class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-40"
                        :class="deleteEmailMatches ? 'bg-error text-white hover:bg-error/90' : 'bg-error/20 text-error cursor-not-allowed'"
                        :disabled="!deleteEmailMatches || deleting"
                        @click="handleDeleteAccount"
                    >
                        <span v-if="deleting" class="flex items-center justify-center gap-2">
                            <Loader2 class="w-4 h-4 animate-spin" /> Deleting...
                        </span>
                        <span v-else>Yes, delete my account</span>
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
