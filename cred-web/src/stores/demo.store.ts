import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, ApiError } from '@/services/api'
import { track } from '@/services/analytics'
import type { ReviewBlock } from '@/types/demo.types'

// Shape returned by the NestJS demo API
interface ApiDemoBlock {
  reviewer_name: string
  review_text: string
  rating: number
  link: string
  empathetic: string
  professional: string
  casual: string
}

function mapApiBlock(b: ApiDemoBlock, index: number): ReviewBlock {
  return {
    id: String(index),
    restaurant_name: '',
    reviewer_name: b.reviewer_name,
    review_text: b.review_text,
    rating: b.rating,
    link: b.link,
    response_a: b.empathetic,
    response_b: b.professional,
    response_c: b.casual,
  }
}

export interface SearchResult {
  google_place_id: string
  name: string
  location: string
  rating: number | null
  review_count: number
}

const STORAGE_KEY = 'credwave_demo'

interface StoredDemo {
  phase: 'disambiguation' | 'results'
  query: string
  searchResults: SearchResult[]
  blocks: ReviewBlock[]
}

export const useDemoStore = defineStore('demo', () => {
  const blocks = ref<ReviewBlock[]>([])
  const searchResults = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')

  function saveToStorage(phase: 'disambiguation' | 'results') {
    const state: StoredDemo = {
      phase,
      query: searchQuery.value,
      searchResults: searchResults.value,
      blocks: blocks.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function restoreFromStorage(): { phase: 'disambiguation' | 'results'; query: string } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const state = JSON.parse(raw) as StoredDemo
      searchResults.value = state.searchResults
      blocks.value = state.blocks
      searchQuery.value = state.query
      return { phase: state.phase, query: state.query }
    } catch {
      return null
    }
  }

  async function searchRestaurants(q: string) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get<{ results: SearchResult[] }>(
        `/restaurants/search?q=${encodeURIComponent(q)}`,
      )
      searchResults.value = data.results
      searchQuery.value = q
      if (data.results.length > 0) saveToStorage('disambiguation')
      track('demo_searched', { query: q, results: data.results.length })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
      searchResults.value = []
    } finally {
      loading.value = false
    }
  }

  async function generateDemo(placeId: string, restaurantName: string) {
    loading.value = true
    error.value = null
    try {
      const data = await api.post<{ blocks: ApiDemoBlock[] }>('/demo/generate', {
        place_id: placeId,
        name: restaurantName,
      })
      blocks.value = data.blocks.map(mapApiBlock)
      saveToStorage('results')
      track('demo_generated', { restaurant: restaurantName, blocks: data.blocks.length })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Generation failed'
      track('demo_generation_failed', { restaurant: restaurantName })
      blocks.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchAdminBlocks(slug: string) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get<{ blocks: ApiDemoBlock[] }>(`/demo/restaurants/${slug}`)
      blocks.value = data.blocks.map(mapApiBlock)
      track('demo_admin_viewed', { slug })
    } catch (e) {
      error.value = e instanceof ApiError && e.status === 404 ? 'not_found' : 'error'
      blocks.value = []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    blocks.value = []
    searchResults.value = []
    searchQuery.value = ''
    error.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    blocks,
    searchResults,
    loading,
    error,
    searchRestaurants,
    generateDemo,
    fetchAdminBlocks,
    reset,
    restoreFromStorage,
  }
})
