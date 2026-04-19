<script setup lang="ts">
import { ref } from 'vue'
import { Save, Loader2, Check, Zap } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user.store'

const userStore = useUserStore()

const saving = ref(false)
const saved = ref(false)

const toneOptions = [
  { value: 'empathetic', label: 'Empathetic', desc: 'Warm, understanding, emotionally aware responses' },
  { value: 'professional', label: 'Professional', desc: 'Polished, business-appropriate, courteous responses' },
  { value: 'casual', label: 'Casual', desc: 'Friendly, relaxed, conversational responses' },
]

async function handleSave() {
  saving.value = true
  // Simulate save
  await new Promise(r => setTimeout(r, 1000))
  saving.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}
</script>

<template>
  <div class="p-8 max-w-[720px]">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-xl font-bold font-display text-text-primary">Settings</h1>
        <p class="text-sm text-text-muted mt-0.5">Manage your profile, restaurant, and auto-reply preferences.</p>
      </div>
      <button
        class="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
        :class="saved
          ? 'bg-success/10 text-success'
          : 'bg-brand text-white hover:bg-brand-subtle'"
        :disabled="saving"
        @click="handleSave"
      >
        <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
        <Check v-else-if="saved" class="w-4 h-4" />
        <Save v-else class="w-4 h-4" />
        {{ saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes' }}
      </button>
    </div>

    <div class="space-y-8">
      <!-- ═══ Profile ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl p-6">
        <h2 class="text-sm font-bold text-text-primary mb-4">Profile</h2>

        <div class="flex items-center gap-4 mb-5">
          <div class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <span class="text-lg font-bold text-accent">{{ userStore.restaurant.ownerName.charAt(0) }}</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-text-primary">{{ userStore.restaurant.ownerName }}</p>
            <p class="text-xs text-text-muted">{{ userStore.profile.email }}</p>
            <p class="text-[10px] text-text-muted mt-0.5">Managed via your Google account</p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
          <input
            :value="userStore.profile.email"
            disabled
            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg bg-surface-warm text-text-muted cursor-not-allowed"
          />
          <p class="text-[10px] text-text-muted mt-1">Email is linked to your Google account and cannot be changed here.</p>
        </div>
      </section>

      <!-- ═══ Restaurant ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl p-6">
        <h2 class="text-sm font-bold text-text-primary mb-4">Restaurant</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Restaurant Name</label>
            <input
              v-model="userStore.restaurant.name"
              class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Owner Name</label>
            <input
              v-model="userStore.restaurant.ownerName"
              class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Additional Information</label>
            <textarea
              v-model="userStore.restaurant.additionalInfo"
              rows="5"
              placeholder="Tell us about your restaurant — cuisine, vibe, history, anything that helps us write better responses..."
              class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none leading-relaxed"
            />
            <p class="text-[10px] text-text-muted mt-1">This info helps our AI write more authentic, on-brand responses.</p>
          </div>
        </div>
      </section>

      <!-- ═══ Auto-Reply ═══ -->
      <section class="bg-white border border-border-subtle rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Zap class="w-4 h-4 text-accent" />
            <h2 class="text-sm font-bold text-text-primary">Auto-Reply</h2>
          </div>
          <button
            class="relative w-10 h-5.5 rounded-full transition-colors duration-200"
            :class="userStore.autoReply.enabled ? 'bg-accent' : 'bg-border'"
            @click="userStore.setAutoReplyEnabled(!userStore.autoReply.enabled)"
          >
            <span
              class="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all duration-200"
              :class="userStore.autoReply.enabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
        </div>

        <p class="text-xs text-text-muted mb-5">
          When enabled, CredWave will automatically generate and post a response to every new review using your preferred tone.
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-2">Default Tone</label>
            <div class="space-y-2">
              <label
                v-for="tone in toneOptions"
                :key="tone.value"
                class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
                :class="userStore.autoReply.defaultTone === tone.value
                  ? 'border-accent/30 bg-accent/[0.03]'
                  : 'border-border-subtle hover:border-border'"
              >
                <input
                  v-model="userStore.autoReply.defaultTone"
                  type="radio"
                  :value="tone.value"
                  class="mt-0.5 accent-accent"
                />
                <div>
                  <p class="text-sm font-semibold text-text-primary">{{ tone.label }}</p>
                  <p class="text-xs text-text-muted mt-0.5">{{ tone.desc }}</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1.5">Custom Instructions (optional)</label>
            <textarea
              v-model="userStore.autoReply.customInstructions"
              rows="3"
              placeholder="e.g. Always mention our weekend brunch special, avoid using emoji, sign off with the owner's first name..."
              class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none leading-relaxed"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
