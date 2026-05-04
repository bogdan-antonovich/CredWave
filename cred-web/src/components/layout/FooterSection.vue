<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="bg-surface-dark border-t border-white/5">
    <div class="mx-auto max-w-[1200px] px-6 py-14">
      <div class="flex flex-col md:flex-row justify-between items-start gap-8">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/10 text-white text-[10px] font-extrabold font-display tracking-tight leading-none">CW</span>
            <p class="text-lg font-bold tracking-tight font-display text-white">CredWave</p>
          </div>
          <p class="text-sm text-white/35">AI-powered review management for restaurants.</p>
        </div>
        <div class="flex gap-10 text-sm text-white/40">
          <div class="flex flex-col gap-2.5">
            <RouterLink to="/demo" class="hover:text-white/70 transition-colors duration-200">Demo</RouterLink>
            <RouterLink to="/pricing" class="hover:text-white/70 transition-colors duration-200">Pricing</RouterLink>
          </div>
          <div class="flex flex-col gap-2.5">
            <RouterLink to="/contact" class="hover:text-white/70 transition-colors duration-200">Contact</RouterLink>
            <RouterLink to="/privacy" class="hover:text-white/70 transition-colors duration-200">Privacy Policy</RouterLink>
            <RouterLink to="/terms" class="hover:text-white/70 transition-colors duration-200">Terms of Service</RouterLink>
          </div>
        </div>
      </div>
      <div class="mt-12 pt-6 border-t border-white/5 text-xs text-white/25">
        &copy; {{ new Date().getFullYear() }} CredWave. All rights reserved.
      </div>
    </div>
  </footer>
</template>
