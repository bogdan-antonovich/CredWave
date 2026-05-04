import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { identifyUser, resetUser } from '@/services/analytics'

interface ApiUser {
  id: number
  email: string
  name: string
  picture_url: string
  google_access_token_valid: boolean
}

interface ApiRestaurant {
  id: string
  name: string
  slug: string
  address: string | null
  ownerName: string | null
  additionalInfo: string | null
  updatedAt: string
}

interface ApiAutoReply {
  enabled: boolean
  defaultTone: 'empathetic' | 'professional' | 'casual'
  customInstructions: string
}

export const useUserStore = defineStore('user', () => {
  const loading = ref(false)
  const restaurantId = ref<string | null>(null)

  const profile = ref({
    email: '',
    name: '',
    pictureUrl: '',
  })

  const restaurant = ref({
    name: '',
    ownerName: '',
    additionalInfo: '',
  })

  const autoReply = ref<ApiAutoReply>({
    enabled: false,
    defaultTone: 'professional',
    customInstructions: '',
  })

  async function fetchAll() {
    loading.value = true
    try {
      const user = await api.get<ApiUser>('/users/me')
      profile.value.email = user.email
      profile.value.name = user.name
      profile.value.pictureUrl = user.picture_url
      identifyUser(String(user.id), { email: user.email, name: user.name })
    } catch {
      loading.value = false
      return
    }

    try {
      const data = await api.get<{ restaurants: ApiRestaurant[] }>('/restaurants')
      const restaurants = data.restaurants ?? []

      if (restaurants.length > 0) {
        const r = restaurants[0]
        restaurantId.value = r.id
        restaurant.value.name = r.name ?? ''
        restaurant.value.ownerName = r.ownerName ?? ''
        restaurant.value.additionalInfo = r.additionalInfo ?? ''

        const ar = await api.get<ApiAutoReply>(`/restaurants/${r.id}/auto-reply`)
        autoReply.value.enabled = ar.enabled ?? false
        autoReply.value.defaultTone = ar.defaultTone ?? 'professional'
        autoReply.value.customInstructions = ar.customInstructions ?? ''
      }
    } catch {
      // Restaurant fetch failed (e.g. Google API error) — profile is still set
    } finally {
      loading.value = false
    }
  }

  async function saveSettings() {
    if (!restaurantId.value) return

    await Promise.all([
      api.patch(`/restaurants/${restaurantId.value}`, {
        name: restaurant.value.name,
        ownerName: restaurant.value.ownerName,
        additionalInfo: restaurant.value.additionalInfo,
      }),
      api.patch(`/restaurants/${restaurantId.value}/auto-reply`, {
        enabled: autoReply.value.enabled,
        defaultTone: autoReply.value.defaultTone,
        customInstructions: autoReply.value.customInstructions,
      }),
    ])
  }

  function setAutoReplyEnabled(val: boolean) {
    autoReply.value.enabled = val
  }

  function setAutoReplyTone(tone: 'empathetic' | 'professional' | 'casual') {
    autoReply.value.defaultTone = tone
  }

  return {
    loading,
    restaurantId,
    profile,
    restaurant,
    autoReply,
    fetchAll,
    saveSettings,
    setAutoReplyEnabled,
    setAutoReplyTone,
  }
})
