<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Lock, Loader2 } from 'lucide-vue-next'
import { authSchema } from '@/schemas/auth.schema'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const password = ref('')
const validationError = ref<string | null>(null)
const loading = ref(false)

async function handleLogin() {
  validationError.value = null

  const result = authSchema.safeParse({ password: password.value })
  if (!result.success) {
    validationError.value = result.error.issues[0].message
    return
  }

  loading.value = true

  // Simulate slight delay for UX
  await new Promise((r) => setTimeout(r, 300))

  const success = authStore.login(password.value)

  if (success) {
    const redirect = (route.query.redirect as string) || '/admin'
    router.push(redirect)
  } else {
    validationError.value = authStore.error
  }

  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-6 bg-surface-muted">
    <div class="w-full max-w-[380px]">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-xl bg-brand flex items-center justify-center mx-auto mb-4">
          <Lock class="w-5 h-5 text-text-inverse" />
        </div>
        <h1 class="text-2xl font-bold font-display tracking-tight text-text-primary">Admin Access</h1>
        <p class="mt-1 text-sm text-text-secondary">Enter your password to continue</p>
      </div>

      <div class="bg-white rounded-xl border border-border-subtle p-6">
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter admin password"
            class="w-full px-3.5 py-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            @keydown.enter="handleLogin"
          />
          <p v-if="validationError" class="mt-1.5 text-xs text-error">
            {{ validationError }}
          </p>
        </div>

        <button
          class="w-full mt-4 py-2.5 bg-brand text-text-inverse text-sm font-medium rounded-lg hover:bg-brand-subtle transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          :disabled="loading"
          @click="handleLogin"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </div>
    </div>
  </div>
</template>
