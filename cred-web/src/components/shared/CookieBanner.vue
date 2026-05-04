<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { acceptCookies, declineCookies, getStoredConsent } from '@/services/analytics'

const visible = ref(false)

onMounted(() => {
  if (getStoredConsent() === null) {
    visible.value = true
  }
})

function handleAccept() {
  acceptCookies()
  visible.value = false
}

function handleDecline() {
  declineCookies()
  visible.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[560px] bg-white border border-border-subtle rounded-2xl shadow-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
    >
      <p class="flex-1 text-xs text-text-secondary leading-relaxed">
        We use analytics cookies to understand how CredWave is used and improve the product.
        See our
        <RouterLink to="/privacy" class="text-accent hover:underline">Privacy Policy</RouterLink>
        for details.
      </p>
      <div class="flex items-center gap-2 shrink-0">
        <button
          class="px-4 py-2 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-surface-warm transition-colors"
          @click="handleDecline"
        >
          Decline
        </button>
        <button
          class="px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-colors"
          @click="handleAccept"
        >
          Accept
        </button>
      </div>
    </div>
  </Transition>
</template>
