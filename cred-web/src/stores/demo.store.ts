import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ReviewBlock } from '@/types/demo.types'
import { getDemoBlocks } from '@/services/demo.service'

export const useDemoStore = defineStore('demo', () => {
  const blocks = ref<ReviewBlock[]>([])
  const restaurantName = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchBlocks(name: string) {
    loading.value = true
    error.value = null
    restaurantName.value = name

    try {
      blocks.value = await getDemoBlocks(name)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load reviews'
      blocks.value = []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    blocks.value = []
    restaurantName.value = ''
    error.value = null
  }

  return { blocks, restaurantName, loading, error, fetchBlocks, reset }
})
