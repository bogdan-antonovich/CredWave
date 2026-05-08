<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Menu, X, User } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'

defineProps<{
  dark?: boolean
}>()

const route = useRoute()
const auth = useAuthStore()
const mobileOpen = ref(false)
const avatarOpen = ref(false)

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function closeMenu() {
  mobileOpen.value = false
}

function toggleAvatar() {
  avatarOpen.value = !avatarOpen.value
}

function closeAvatar() {
  avatarOpen.value = false
}

function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-avatar-menu]')) {
    avatarOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>

<template>
  <nav
    class="fixed top-0 left-0 right-0 z-50"
    :class="dark
      ? 'bg-transparent'
      : 'bg-white/80 backdrop-blur-lg border-b border-border-subtle'"
  >
    <div class="mx-auto max-w-[1200px] px-6 h-14 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2" @click="closeMenu">
        <span
          class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold font-display tracking-tight leading-none"
          :class="dark ? 'bg-white/10 text-white' : 'bg-brand text-white'"
        >CW</span>
        <span
          class="text-lg font-bold tracking-tight font-display"
          :class="dark ? 'text-white' : 'text-text-primary'"
        >CredWave</span>
      </RouterLink>

      <!-- Desktop nav -->
      <div class="hidden md:flex items-center gap-0">
        <RouterLink
          to="/demo"
          class="text-sm transition-colors duration-200 px-3 py-2 text-center"
          :class="dark
            ? (isActive('/demo') ? 'text-white' : 'text-white/40 hover:text-white/70')
            : (isActive('/demo') ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')"
        >
          Demo
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="text-sm transition-colors duration-200 px-3 py-2 text-center"
          :class="dark
            ? (isActive('/pricing') ? 'text-white' : 'text-white/40 hover:text-white/70')
            : (isActive('/pricing') ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')"
        >
          Pricing
        </RouterLink>
        <RouterLink
          to="/contact"
          class="text-sm transition-colors duration-200 px-3 py-2 text-center"
          :class="dark
            ? (isActive('/contact') ? 'text-white' : 'text-white/40 hover:text-white/70')
            : (isActive('/contact') ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')"
        >
          Contact
        </RouterLink>
        <RouterLink
          v-if="auth.isAuthenticated"
          to="/dashboard"
          class="text-sm transition-colors duration-200 px-3 py-2 text-center"
          :class="dark
            ? (isActive('/dashboard') ? 'text-white' : 'text-white/40 hover:text-white/70')
            : (isActive('/dashboard') ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          v-else
          to="/auth"
          class="text-sm transition-colors duration-200 px-3 py-2 text-center"
          :class="dark
            ? (isActive('/auth') ? 'text-white' : 'text-white/40 hover:text-white/70')
            : (isActive('/auth') ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')"
        >
          Sign in
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="text-sm px-5 py-1.5 rounded-full font-medium transition-all duration-200 hover:scale-[1.02] ml-3"
          :class="dark
            ? 'bg-white text-brand hover:bg-white/90'
            : 'bg-brand text-text-inverse hover:bg-brand-subtle'"
        >
          Get Started
        </RouterLink>
        <div v-if="auth.isAuthenticated" class="relative ml-2" data-avatar-menu>
          <button
            class="w-8 h-8 rounded-full bg-neutral-400 flex items-center justify-center hover:bg-neutral-500 transition-colors"
            @click.stop="toggleAvatar"
          >
            <User class="w-4 h-4 text-white" />
          </button>
          <div
            v-if="avatarOpen"
            class="absolute right-0 top-full mt-2 w-36 bg-white border border-border-subtle rounded-xl shadow-lg overflow-hidden py-1 z-50"
          >
            <button
              class="w-full text-left flex items-center px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
              @click="auth.logout()"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile hamburger -->
      <button
        class="md:hidden p-2 rounded-lg transition-colors"
        :class="dark ? 'text-white hover:bg-white/10' : 'text-text-primary hover:bg-surface-warm'"
        @click="mobileOpen = !mobileOpen"
      >
        <X v-if="mobileOpen" class="w-5 h-5" />
        <Menu v-else class="w-5 h-5" />
      </button>
    </div>

    <!-- Mobile menu dropdown -->
    <div
      v-if="mobileOpen"
      class="md:hidden border-t border-border-subtle bg-white/95 backdrop-blur-lg"
    >
      <div class="px-4 py-3 flex flex-col gap-1">
        <RouterLink
          to="/demo"
          class="px-3 py-2.5 text-sm rounded-lg transition-colors"
          :class="isActive('/demo') ? 'text-text-primary font-semibold bg-surface-warm' : 'text-text-secondary hover:bg-surface-warm'"
          @click="closeMenu"
        >
          Demo
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="px-3 py-2.5 text-sm rounded-lg transition-colors"
          :class="isActive('/pricing') ? 'text-text-primary font-semibold bg-surface-warm' : 'text-text-secondary hover:bg-surface-warm'"
          @click="closeMenu"
        >
          Pricing
        </RouterLink>
        <RouterLink
          to="/contact"
          class="px-3 py-2.5 text-sm rounded-lg transition-colors"
          :class="isActive('/contact') ? 'text-text-primary font-semibold bg-surface-warm' : 'text-text-secondary hover:bg-surface-warm'"
          @click="closeMenu"
        >
          Contact
        </RouterLink>
        <div class="border-t border-border-subtle my-1" />
        <RouterLink
          v-if="auth.isAuthenticated"
          to="/dashboard"
          class="px-3 py-2.5 text-sm text-text-secondary rounded-lg hover:bg-surface-warm transition-colors"
          @click="closeMenu"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          v-else
          to="/auth"
          class="px-3 py-2.5 text-sm text-text-secondary rounded-lg hover:bg-surface-warm transition-colors"
          @click="closeMenu"
        >
          Sign in
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="px-3 py-2.5 text-sm font-semibold text-center bg-brand text-text-inverse rounded-xl hover:bg-brand-subtle transition-all"
          @click="closeMenu"
        >
          Get Started
        </RouterLink>
        <button
          v-if="auth.isAuthenticated"
          class="w-full text-left px-3 py-2.5 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          @click="auth.logout(); closeMenu()"
        >
          Sign out
        </button>
      </div>
    </div>
  </nav>
</template>
