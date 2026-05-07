import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { track } from '@/services/analytics'

export interface ReviewResponses {
  empathetic: string
  professional: string
  casual: string
}

export interface Review {
  id: string
  reviewerName: string
  reviewerAvatarUrl: string
  reviewText: string
  rating: number
  postedAt: string
  replied: boolean
  replyText: string | null
  repliedAt: string | null
  link: string | null
  responses: ReviewResponses | null
  responsesGeneratedAt: string | null
}

interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface Stats {
  pending: number
  replied: number
  total: number
}

export const useReviewsStore = defineStore('reviews', () => {
  const reviews = ref<Review[]>([])
  const pagination = ref<Pagination>({ page: 1, per_page: 20, total: 0, total_pages: 0 })
  const stats = ref<Stats>({ pending: 0, replied: 0, total: 0 })
  const loading = ref(false)
  const generating = ref<Record<string, boolean>>({})
  const sending = ref<Record<string, boolean>>({})

  async function fetchReviews(restaurantId: string, page = 1, status = 'all') {
    loading.value = true
    try {
      const data = await api.get<{ reviews: Review[]; pagination: Pagination; stats: Stats }>(
        `/restaurants/${restaurantId}/reviews?page=${page}&per_page=20&status=${status}`,
      )
      reviews.value = data.reviews
      pagination.value = data.pagination
      stats.value = data.stats
    } finally {
      loading.value = false
    }
  }

  async function generateReplies(reviewId: string) {
    generating.value[reviewId] = true
    try {
      const data = await api.post<{ responses: ReviewResponses; generated_at: string }>(
        `/reviews/${reviewId}/generate`,
      )
      const review = reviews.value.find((r) => r.id === reviewId)
      if (review) {
        review.responses = data.responses
        review.responsesGeneratedAt = data.generated_at
        track('reply_generated', { rating: review.rating })
      }
    } finally {
      generating.value[reviewId] = false
    }
  }

  async function postReply(reviewId: string, text: string) {
    sending.value[reviewId] = true
    try {
      await api.post(`/reviews/${reviewId}/reply`, { text })
      const review = reviews.value.find((r) => r.id === reviewId)
      if (review) {
        review.replied = true
        review.replyText = text
        track('reply_posted', { rating: review.rating })
      }
      stats.value.pending = Math.max(0, stats.value.pending - 1)
      stats.value.replied += 1
    } finally {
      sending.value[reviewId] = false
    }
  }

  return {
    reviews,
    pagination,
    stats,
    loading,
    generating,
    sending,
    fetchReviews,
    generateReplies,
    postReply,
  }
})
