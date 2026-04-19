import { defineStore } from 'pinia'
import { ref } from 'vue'
import { config } from '@/config/env'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const error = ref<string | null>(null)

  function login(password: string): boolean {
    if (password === config.admin.password) {
      isAuthenticated.value = true
      error.value = null
      return true
    }
    error.value = 'Invalid password'
    return false
  }

  function logout() {
    isAuthenticated.value = false
  }

  return { isAuthenticated, error, login, logout }
})
