import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // Profile (from Google OAuth, mostly read-only)
  const profile = ref({
    email: 'alex@bellanapoli.com',
    avatarUrl: '',
  })

  // Restaurant info
  const restaurant = ref({
    name: 'Bella Napoli',
    ownerName: 'Alex Johnson',
    additionalInfo: 'Family-owned Italian restaurant since 1998. Located in downtown Manhattan. Known for authentic Neapolitan pizza and homemade pasta. We source ingredients from local farms and import specialty items from Italy. Dog-friendly patio seating available.',
  })

  // Auto-reply config
  const autoReply = ref({
    enabled: false,
    defaultTone: 'professional' as 'empathetic' | 'professional' | 'casual',
    customInstructions: '',
  })

  function setAutoReplyEnabled(val: boolean) {
    autoReply.value.enabled = val
  }

  function setAutoReplyTone(tone: 'empathetic' | 'professional' | 'casual') {
    autoReply.value.defaultTone = tone
  }

  return {
    profile,
    restaurant,
    autoReply,
    setAutoReplyEnabled,
    setAutoReplyTone,
  }
})
