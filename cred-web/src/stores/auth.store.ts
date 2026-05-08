import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { config } from '@/config/env'
import { resetUser } from '@/services/analytics'

const authUrl = `${config.appUrl}/auth`

const ACCESS_KEY = 'cw_access_token'
const REFRESH_KEY = 'cw_refresh_token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY))

  const isAuthenticated = computed(() => !!accessToken.value)

  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  }

  function clearTokens() {
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  function login() {
    window.location.href = `${config.apiUrl}/auth/google`
  }

  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false

    try {
      const res = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken.value}` },
      })
      if (!res.ok) {
        clearTokens()
        return false
      }
      const data = (await res.json()) as { access_token: string; refresh_token: string }
      setTokens(data.access_token, data.refresh_token)
      return true
    } catch {
      clearTokens()
      return false
    }
  }

  async function logout() {
    if (accessToken.value) {
      try {
        await fetch(`${config.apiUrl}/auth/signout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken.value}` },
        })
      } catch {
        // ignore — we clear tokens regardless
      }
    }
    resetUser()
    clearTokens()
    window.location.href = authUrl
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    setTokens,
    login,
    refresh,
    logout,
  }
})
