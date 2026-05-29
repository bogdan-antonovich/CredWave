<script setup lang="ts">
import { computed } from 'vue'
import { useReveal } from '@/utils/useReveal'
import { useAuthStore } from '@/stores/auth.store'

useReveal()
const auth = useAuthStore()

const hasPendingCheckout = computed(() => !!localStorage.getItem('cw_pending_checkout'))
</script>

<template>
  <div class="min-h-screen bg-surface-dark flex flex-col relative overflow-hidden">

    <div class="flex-1 flex items-center justify-center px-6 relative pt-14">
      <!-- Ambient orbs -->
      <div class="absolute top-[30%] left-[40%] w-[500px] h-[400px] rounded-full bg-accent/6 blur-[120px] pointer-events-none drift-1" />
      <div class="absolute bottom-[20%] right-[15%] w-[300px] h-[300px] rounded-full bg-violet-500/4 blur-[90px] pointer-events-none drift-2" />

      <div class="relative z-10 w-full max-w-[400px]">
        <div class="reveal text-center mb-10">
          <template v-if="hasPendingCheckout">
            <h1 class="text-2xl font-bold font-display tracking-tight text-white">
              One step away
            </h1>
            <p class="mt-2 text-sm text-white/40">
              Sign in with Google to complete your purchase. You'll be taken straight to checkout.
            </p>
          </template>
          <template v-else>
            <h1 class="text-2xl font-bold font-display tracking-tight text-white">
              Sign in to your dashboard
            </h1>
            <p class="mt-2 text-sm text-white/40">
              Connect your Google account to start managing reviews.
            </p>
          </template>
        </div>

        <div class="reveal">
          <button
            class="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-text-primary text-sm font-semibold rounded-xl hover:bg-white/95 transition-all duration-200 hover:scale-[1.01] shadow-lg disabled:opacity-50"
            @click="auth.login()"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p class="mt-6 text-center text-xs text-white/25">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
