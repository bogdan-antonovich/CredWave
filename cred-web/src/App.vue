<script setup lang="ts">
import { computed, ref, provide } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from '@/components/layout/NavBar.vue'
import CookieBanner from '@/components/shared/CookieBanner.vue'
import { isDashboardDomain } from '@/utils/domain'

const route = useRoute()

// Pages that hide the global nav entirely (they have their own sidebar)
const hideNav = computed(() => {
  if (isDashboardDomain) return true
  const path = route.path
  return path === '/admin' || path === '/login'
})

// Auth page needs dark nav
const darkNav = computed(() => route.path === '/auth')

// HomePage can hide the nav until scrolled — exposed via provide/inject
const heroVisible = ref(false)
provide('heroVisible', heroVisible)

const isHome = computed(() => route.path === '/')

const showNav = computed(() => {
  if (hideNav.value) return false
  if (isHome.value) return !heroVisible.value
  return true
})
</script>

<template>
  <Transition name="nav-slide">
    <NavBar v-if="showNav" :dark="darkNav" />
  </Transition>
  <RouterView />
  <CookieBanner />
</template>

<style>
.nav-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.7, 0, 0.84, 0),
              opacity 0.25s cubic-bezier(0.7, 0, 0.84, 0);
}
.nav-slide-enter-from,
.nav-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
