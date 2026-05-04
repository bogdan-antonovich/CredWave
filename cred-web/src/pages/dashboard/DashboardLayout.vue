<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { LayoutDashboard, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user.store'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const showUserMenu = ref(false)
const userStore = useUserStore()
const auth = useAuthStore()

const navItems = [
  { to: '/dashboard', label: 'Reviews', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
]

function isActive(item: typeof navItems[number]) {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}

onMounted(() => void userStore.fetchAll())

function handleLogout() {
  void auth.logout()
}
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <!-- Sidebar — fixed full height -->
    <aside class="fixed top-0 left-0 bottom-0 w-[240px] bg-white border-r border-border-subtle flex flex-col z-40">
      <!-- Logo -->
      <div class="px-5 h-14 flex items-center gap-2 border-b border-border-subtle">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white text-xs font-extrabold font-display tracking-tight leading-none">CW</span>
        <span class="text-base font-bold tracking-tight text-text-primary font-display">CredWave</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          :class="isActive(item)
            ? 'bg-surface-warm text-text-primary'
            : 'text-text-muted hover:text-text-secondary hover:bg-surface-warm/50'"
        >
          <component
            :is="item.icon"
            class="w-4 h-4"
            :class="isActive(item) ? 'text-accent' : ''"
          />
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- User section -->
      <div class="px-3 pb-4">
        <div class="relative">
          <button
            class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface-warm transition-colors text-left"
            @click="showUserMenu = !showUserMenu"
          >
            <div class="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <span v-if="userStore.loading" class="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              <span v-else class="text-xs font-bold text-accent">
                {{ (userStore.restaurant.ownerName || userStore.profile.name || '?').charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-text-primary truncate">
                {{ userStore.restaurant.ownerName || userStore.profile.name || '—' }}
              </p>
              <p class="text-[10px] text-text-muted truncate">{{ userStore.restaurant.name || userStore.profile.email }}</p>
            </div>
            <ChevronDown class="w-3.5 h-3.5 text-text-muted shrink-0" />
          </button>

          <!-- Dropdown -->
          <div
            v-if="showUserMenu"
            class="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border-subtle rounded-xl shadow-lg py-1 z-20"
          >
            <RouterLink
              to="/dashboard/settings"
              class="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-warm transition-colors"
              @click="showUserMenu = false"
            >
              <Settings class="w-3.5 h-3.5" />
              Settings
            </RouterLink>
            <RouterLink
              to="/dashboard/billing"
              class="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-warm transition-colors"
              @click="showUserMenu = false"
            >
              <CreditCard class="w-3.5 h-3.5" />
              Billing
            </RouterLink>
            <div class="border-t border-border-subtle my-1" />
            <button
              class="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors text-left"
              @click="handleLogout"
            >
              <LogOut class="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main content — offset by sidebar width -->
    <div class="ml-[240px] min-h-screen overflow-y-auto">
      <RouterView />
    </div>
  </div>
</template>
