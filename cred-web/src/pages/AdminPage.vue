<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  LogOut,
  X,
  ExternalLink,
  Store,
  MessageSquare,
  Copy,
  Check,
  Tag,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'
import { config } from '@/config/env'

interface AdminRestaurant {
  name: string
  slug: string
}

interface AdminResponse {
  text: string
  tone: 'empathetic' | 'professional' | 'casual'
}

interface AdminBlock {
  id: number
  restaurant_name: string
  reviewer_name: string
  review_text: string
  rating: number
  link: string
  responses: AdminResponse[]
}

interface EditingBlock {
  id: number | null
  reviewer_name: string
  review_text: string
  rating: number
  link: string
  empathetic: string
  professional: string
  casual: string
}

interface PromoCode {
  code: string
  durationDays: number
  maxUses?: number
  useCount?: number
  expiresAt?: string
  isActive: boolean
}

interface EditingPromo {
  isNew: boolean
  code: string
  durationDays: number
  maxUses: string
  expiresAt: string
  isActive: boolean
}

const router = useRouter()
const authStore = useAuthStore()

// Section
const activeSection = ref<'restaurants' | 'promo'>('restaurants')

// Restaurants
const restaurants = ref<AdminRestaurant[]>([])
const selectedSlug = ref('')
const showNewRestaurant = ref(false)
const newRestaurantName = ref('')
const newRestaurantSlug = ref('')
const newRestaurantError = ref<string | null>(null)
const creatingRestaurant = ref(false)

const blocks = ref<AdminBlock[]>([])
const loadingBlocks = ref(false)

const editing = ref<EditingBlock | null>(null)
const saving = ref(false)
const generating = ref(false)

const urlCopied = ref(false)

// Promo codes
const promoCodes = ref<PromoCode[]>([])
const loadingPromo = ref(false)
const editingPromo = ref<EditingPromo | null>(null)
const savingPromo = ref(false)
const promoError = ref<string | null>(null)

const selectedRestaurant = computed(() =>
  restaurants.value.find((r) => r.slug === selectedSlug.value) ?? null,
)

const demoUrl = computed(() =>
  selectedSlug.value ? `${config.appUrl}/demo/${selectedSlug.value}` : '',
)

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function onNameInput() {
  newRestaurantSlug.value = slugify(newRestaurantName.value)
}

onMounted(async () => {
  try {
    await loadRestaurants()
  } catch {
    void router.replace('/')
  }
})

async function loadRestaurants() {
  const data = await api.get<{ restaurants: AdminRestaurant[] }>('/admin/restaurants')
  restaurants.value = data.restaurants
  if (restaurants.value.length > 0 && !selectedSlug.value) {
    selectedSlug.value = restaurants.value[0].slug
    await loadBlocks()
  }
}

async function createRestaurant() {
  newRestaurantError.value = null
  const name = newRestaurantName.value.trim()
  const slug = newRestaurantSlug.value.trim()

  if (name.length < 2) {
    newRestaurantError.value = 'Name must be at least 2 characters'
    return
  }
  if (!slug) {
    newRestaurantError.value = 'Slug cannot be empty'
    return
  }
  if (restaurants.value.some((r) => r.slug === slug)) {
    newRestaurantError.value = 'A restaurant with this slug already exists'
    return
  }

  creatingRestaurant.value = true
  try {
    await api.post('/admin/restaurants', { name, slug })
    await loadRestaurants()
    selectedSlug.value = slug
    await loadBlocks()
    showNewRestaurant.value = false
    newRestaurantName.value = ''
    newRestaurantSlug.value = ''
  } catch {
    newRestaurantError.value = 'Failed to create restaurant'
  } finally {
    creatingRestaurant.value = false
  }
}

async function deleteRestaurant(slug: string) {
  if (!confirm(`Delete "${slug}" and all its review blocks?`)) return
  try {
    await api.del(`/admin/restaurants/${slug}`)
    restaurants.value = restaurants.value.filter((r) => r.slug !== slug)
    if (selectedSlug.value === slug) {
      selectedSlug.value = restaurants.value[0]?.slug ?? ''
      blocks.value = []
      if (selectedSlug.value) await loadBlocks()
    }
  } catch {
    // ignore
  }
}

async function selectRestaurant(slug: string) {
  selectedSlug.value = slug
  await loadBlocks()
}

async function loadBlocks() {
  if (!selectedSlug.value) return
  loadingBlocks.value = true
  try {
    const data = await api.get<{ blocks: AdminBlock[] }>(`/admin/restaurants/${selectedSlug.value}`)
    blocks.value = data.blocks
  } catch {
    blocks.value = []
  } finally {
    loadingBlocks.value = false
  }
}

const selectedRestaurantName = computed(
  () => restaurants.value.find((r) => r.slug === selectedSlug.value)?.name ?? '',
)

function getResponse(block: AdminBlock, tone: AdminResponse['tone']) {
  return block.responses.find((r) => r.tone === tone)?.text ?? ''
}

function startEdit(block?: AdminBlock) {
  if (block) {
    editing.value = {
      id: block.id,
      reviewer_name: block.reviewer_name,
      review_text: block.review_text,
      rating: block.rating,
      link: block.link,
      empathetic: getResponse(block, 'empathetic'),
      professional: getResponse(block, 'professional'),
      casual: getResponse(block, 'casual'),
    }
  } else {
    editing.value = {
      id: null,
      reviewer_name: '',
      review_text: '',
      rating: 5,
      link: '',
      empathetic: '',
      professional: '',
      casual: '',
    }
  }
}

function toResponses(e: EditingBlock): AdminResponse[] {
  return (
    (['empathetic', 'professional', 'casual'] as const)
      .filter((t) => e[t].trim())
      .map((t) => ({ tone: t, text: e[t] }))
  )
}

async function handleSave() {
  if (!editing.value) return
  saving.value = true
  try {
    const payload = {
      reviewerName: editing.value.reviewer_name,
      reviewText: editing.value.review_text,
      rating: editing.value.rating,
      link: editing.value.link,
      responses: toResponses(editing.value),
    }

    if (editing.value.id === null) {
      await api.post(`/admin/restaurants/${selectedSlug.value}/blocks`, payload)
    } else {
      await api.put(`/admin/blocks/${editing.value.id}`, payload)
    }

    await loadBlocks()
    editing.value = null
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function generateResponses() {
  if (!editing.value) return
  generating.value = true
  try {
    const result = await api.post<{ empathetic: string; professional: string; casual: string }>(
      '/admin/blocks/generate',
      {
        restaurantName: selectedRestaurantName.value,
        reviewerName: editing.value.reviewer_name,
        reviewText: editing.value.review_text,
        rating: editing.value.rating,
      },
    )
    editing.value.empathetic = result.empathetic
    editing.value.professional = result.professional
    editing.value.casual = result.casual
  } catch (e) {
    console.error(e)
  } finally {
    generating.value = false
  }
}

async function handleDeleteBlock(id: number) {
  if (!confirm('Delete this review block?')) return
  try {
    await api.del(`/admin/blocks/${id}`)
    blocks.value = blocks.value.filter((b) => b.id !== id)
  } catch {
    // ignore
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(demoUrl.value)
    urlCopied.value = true
    setTimeout(() => { urlCopied.value = false }, 2000)
  } catch { /* */ }
}

function handleLogout() {
  void authStore.logout()
}

const responseLabels: { key: 'empathetic' | 'professional' | 'casual'; label: string }[] = [
  { key: 'empathetic', label: 'Empathetic' },
  { key: 'professional', label: 'Professional' },
  { key: 'casual', label: 'Casual' },
]

// Promo code functions
async function switchToPromo() {
  activeSection.value = 'promo'
  await loadPromoCodes()
}

async function loadPromoCodes() {
  loadingPromo.value = true
  try {
    promoCodes.value = await api.get<PromoCode[]>('/admin/promo-codes')
  } catch {
    promoCodes.value = []
  } finally {
    loadingPromo.value = false
  }
}

function openCreatePromo() {
  promoError.value = null
  editingPromo.value = {
    isNew: true,
    code: '',
    durationDays: 30,
    maxUses: '',
    expiresAt: '',
    isActive: true,
  }
}

function openEditPromo(promo: PromoCode) {
  promoError.value = null
  editingPromo.value = {
    isNew: false,
    code: promo.code,
    durationDays: promo.durationDays,
    maxUses: promo.maxUses != null ? String(promo.maxUses) : '',
    expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : '',
    isActive: promo.isActive,
  }
}

async function handleSavePromo() {
  if (!editingPromo.value) return
  promoError.value = null

  const e = editingPromo.value
  const code = e.code.trim().toUpperCase()

  if (!code) { promoError.value = 'Code is required'; return }
  if (!e.durationDays || e.durationDays < 1) { promoError.value = 'Duration must be at least 1 day'; return }

  const maxUses = e.maxUses.trim() ? Number(e.maxUses) : undefined
  if (maxUses !== undefined && (isNaN(maxUses) || maxUses < 1)) {
    promoError.value = 'Max uses must be a positive number'
    return
  }

  const expiresAt = e.expiresAt ? new Date(e.expiresAt).toISOString() : undefined

  savingPromo.value = true
  try {
    if (e.isNew) {
      await api.post('/admin/promo-codes', {
        code,
        durationDays: e.durationDays,
        maxUses,
        expiresAt,
        isActive: e.isActive,
      })
    } else {
      await api.patch(`/admin/promo-codes/${code}`, {
        durationDays: e.durationDays,
        maxUses,
        expiresAt,
        isActive: e.isActive,
      })
    }
    await loadPromoCodes()
    editingPromo.value = null
  } catch {
    promoError.value = e.isNew ? 'Failed to create code — it may already exist.' : 'Failed to save changes.'
  } finally {
    savingPromo.value = false
  }
}

async function deletePromoCode(code: string) {
  if (!confirm(`Delete promo code "${code}"?`)) return
  try {
    await api.del(`/admin/promo-codes/${code}`)
    promoCodes.value = promoCodes.value.filter((p) => p.code !== code)
  } catch {
    // ignore
  }
}

function formatExpiry(iso?: string) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatUses(promo: PromoCode) {
  const used = promo.useCount ?? 0
  return promo.maxUses != null ? `${used} / ${promo.maxUses}` : `${used} / ∞`
}
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <!-- Header -->
    <header class="bg-white border-b border-border-subtle">
      <div class="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white text-xs font-extrabold font-display tracking-tight leading-none">CW</span>
            <p class="text-sm font-bold font-display">Admin</p>
          </div>
          <!-- Section tabs -->
          <div class="flex items-center gap-1 bg-surface-warm rounded-lg p-1">
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="activeSection === 'restaurants'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'"
              @click="activeSection = 'restaurants'"
            >
              <Store class="w-3.5 h-3.5" />
              Restaurants
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="activeSection === 'promo'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'"
              @click="switchToPromo"
            >
              <Tag class="w-3.5 h-3.5" />
              Promo Codes
            </button>
          </div>
        </div>
        <button
          class="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
          @click="handleLogout"
        >
          <LogOut class="w-4 h-4" />
          Sign out
        </button>
      </div>
    </header>

    <!-- RESTAURANTS SECTION -->
    <div v-if="activeSection === 'restaurants'" class="max-w-[1200px] mx-auto px-6 py-8 flex gap-8">
      <!-- Sidebar -->
      <aside class="w-[280px] shrink-0">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold text-text-muted uppercase tracking-wider">Restaurant Pages</p>
          <button
            class="p-1.5 rounded-lg hover:bg-white transition-colors text-text-muted hover:text-text-primary"
            title="New restaurant page"
            @click="showNewRestaurant = !showNewRestaurant"
          >
            <Plus class="w-4 h-4" />
          </button>
        </div>

        <!-- New restaurant form -->
        <div v-if="showNewRestaurant" class="mb-4 p-3 rounded-xl bg-white border border-border-subtle">
          <div class="space-y-2 mb-3">
            <div>
              <label class="block text-[10px] font-medium text-text-muted mb-1">Restaurant name</label>
              <input
                v-model="newRestaurantName"
                type="text"
                placeholder="e.g. Bella Napoli"
                class="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                @input="onNameInput"
                @keydown.enter="createRestaurant"
              />
            </div>
            <div>
              <label class="block text-[10px] font-medium text-text-muted mb-1">URL slug</label>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-text-muted shrink-0">/demo/</span>
                <input
                  v-model="newRestaurantSlug"
                  type="text"
                  placeholder="bella-napoli"
                  class="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  @keydown.enter="createRestaurant"
                />
              </div>
            </div>
          </div>
          <p v-if="newRestaurantError" class="text-xs text-error mb-2">{{ newRestaurantError }}</p>
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              :disabled="creatingRestaurant"
              @click="createRestaurant"
            >
              <Loader2 v-if="creatingRestaurant" class="w-3 h-3 animate-spin" />
              Create Page
            </button>
            <button
              class="px-3 py-1.5 text-xs text-text-muted border border-border rounded-lg hover:bg-surface-warm transition-colors"
              @click="showNewRestaurant = false; newRestaurantName = ''; newRestaurantSlug = ''"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Restaurant list -->
        <div class="space-y-1">
          <div
            v-for="r in restaurants"
            :key="r.slug"
            class="group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
            :class="r.slug === selectedSlug
              ? 'bg-white border border-border shadow-sm'
              : 'hover:bg-white/60'"
            @click="selectRestaurant(r.slug)"
          >
            <Store
              class="w-4 h-4 shrink-0"
              :class="r.slug === selectedSlug ? 'text-accent' : 'text-text-muted'"
            />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium truncate"
                :class="r.slug === selectedSlug ? 'text-text-primary' : 'text-text-secondary'"
              >
                {{ r.name }}
              </p>
              <p class="text-[10px] text-text-muted truncate">/demo/{{ r.slug }}</p>
            </div>
            <button
              class="p-1 rounded-md opacity-0 group-hover:opacity-100 text-text-muted hover:text-error hover:bg-error/5 transition-all"
              title="Delete restaurant page"
              @click.stop="deleteRestaurant(r.slug)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="restaurants.length === 0" class="text-center py-8 text-xs text-text-muted">
            No restaurant pages yet.<br />Click + to create one.
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 min-w-0">
        <template v-if="selectedRestaurant">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-bold font-display text-text-primary">
                {{ selectedRestaurant.name }}
              </h2>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-xs text-text-muted">{{ blocks.length }} review block{{ blocks.length !== 1 ? 's' : '' }}</span>
                <span class="text-xs text-text-muted">·</span>
                <div class="flex items-center gap-1.5">
                  <code class="text-xs text-accent bg-accent/5 px-2 py-0.5 rounded">/demo/{{ selectedSlug }}</code>
                  <button
                    class="p-1 rounded text-text-muted hover:text-accent transition-colors"
                    title="Copy demo URL"
                    @click="copyUrl"
                  >
                    <Check v-if="urlCopied" class="w-3 h-3 text-success" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                  <a
                    :href="demoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1 rounded text-text-muted hover:text-accent transition-colors"
                    title="Open demo page"
                  >
                    <ExternalLink class="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <button
              class="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all"
              @click="startEdit()"
            >
              <Plus class="w-4 h-4" />
              Add Review Block
            </button>
          </div>

          <div v-if="loadingBlocks" class="flex justify-center py-20">
            <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="block in blocks"
              :key="block.id"
              class="bg-white border border-border-subtle rounded-xl overflow-hidden"
            >
              <div class="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
                <div class="flex items-center gap-3">
                  <p class="text-sm font-semibold text-text-primary">{{ block.reviewer_name }}</p>
                  <div class="flex gap-0.5">
                    <span
                      v-for="s in 5"
                      :key="s"
                      class="text-xs"
                      :class="s <= block.rating ? 'text-warning' : 'text-border'"
                    >★</span>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-warm transition-all"
                    title="Edit"
                    @click="startEdit(block)"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/5 transition-all"
                    title="Delete"
                    @click="handleDeleteBlock(block.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div class="px-5 py-3">
                <p class="text-sm text-text-secondary leading-relaxed">{{ block.review_text }}</p>
              </div>

              <div class="px-5 pb-4 flex gap-2">
                <div
                  v-for="{ key, label } in responseLabels"
                  :key="key"
                  class="flex-1 p-2.5 rounded-lg bg-surface-warm"
                >
                  <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">{{ label }}</p>
                  <p class="text-xs text-text-secondary line-clamp-2">{{ getResponse(block, key) }}</p>
                </div>
              </div>
            </div>

            <div v-if="blocks.length === 0" class="text-center py-20 bg-white rounded-xl border border-border-subtle">
              <MessageSquare class="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p class="text-sm font-medium text-text-primary">No review blocks yet</p>
              <p class="text-xs text-text-muted mt-1">Add your first review block to populate the demo page.</p>
              <button
                class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all"
                @click="startEdit()"
              >
                <Plus class="w-3.5 h-3.5" />
                Add Review Block
              </button>
            </div>
          </div>
        </template>

        <div v-else class="text-center py-20">
          <Store class="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p class="text-sm font-medium text-text-primary">No restaurant selected</p>
          <p class="text-xs text-text-muted mt-1">Create a restaurant page from the sidebar to get started.</p>
        </div>
      </main>
    </div>

    <!-- PROMO CODES SECTION -->
    <div v-else class="max-w-[1200px] mx-auto px-6 py-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-lg font-bold font-display text-text-primary">Promo Codes</h2>
          <p class="text-xs text-text-muted mt-0.5">{{ promoCodes.length }} code{{ promoCodes.length !== 1 ? 's' : '' }}</p>
        </div>
        <button
          class="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all"
          @click="openCreatePromo"
        >
          <Plus class="w-4 h-4" />
          Create Code
        </button>
      </div>

      <div v-if="loadingPromo" class="flex justify-center py-20">
        <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
      </div>

      <template v-else>
        <!-- Table header -->
        <div v-if="promoCodes.length > 0" class="bg-white border border-border-subtle rounded-xl overflow-hidden">
          <div class="grid grid-cols-[1fr_100px_90px_130px_80px_72px] gap-4 px-5 py-2.5 border-b border-border-subtle">
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Code</p>
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Duration</p>
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Uses</p>
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Expires</p>
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Status</p>
            <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider"></p>
          </div>

          <div
            v-for="promo in promoCodes"
            :key="promo.code"
            class="grid grid-cols-[1fr_100px_90px_130px_80px_72px] gap-4 items-center px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-surface-warm/50 transition-colors"
          >
            <code class="text-sm font-mono font-semibold text-text-primary">{{ promo.code }}</code>
            <p class="text-sm text-text-secondary">{{ promo.durationDays }}d</p>
            <p class="text-sm text-text-secondary tabular-nums">{{ formatUses(promo) }}</p>
            <p class="text-sm text-text-secondary">{{ formatExpiry(promo.expiresAt) }}</p>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit"
              :class="promo.isActive
                ? 'bg-success/10 text-success'
                : 'bg-border text-text-muted'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="promo.isActive ? 'bg-success' : 'bg-text-muted'" />
              {{ promo.isActive ? 'Active' : 'Inactive' }}
            </span>
            <div class="flex items-center gap-1 justify-end">
              <button
                class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-warm transition-all"
                title="Edit"
                @click="openEditPromo(promo)"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/5 transition-all"
                title="Delete"
                @click="deletePromoCode(promo.code)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-20 bg-white rounded-xl border border-border-subtle">
          <Tag class="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p class="text-sm font-medium text-text-primary">No promo codes yet</p>
          <p class="text-xs text-text-muted mt-1">Create your first code to give users trial access.</p>
          <button
            class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all"
            @click="openCreatePromo"
          >
            <Plus class="w-3.5 h-3.5" />
            Create Code
          </button>
        </div>
      </template>
    </div>

    <!-- Review block edit modal -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
        @click.self="editing = null"
      >
        <div class="w-full max-w-[640px] bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <p class="text-sm font-bold font-display">{{ editing.id ? 'Edit' : 'New' }} Review Block</p>
            <button class="p-1.5 hover:bg-surface-warm rounded-lg transition-colors" @click="editing = null">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-text-secondary mb-1.5">Reviewer Name</label>
                <input
                  v-model="editing.reviewer_name"
                  placeholder="e.g. Sarah M."
                  class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-secondary mb-1.5">Rating (1–5)</label>
                <input
                  v-model.number="editing.rating"
                  type="number"
                  min="1"
                  max="5"
                  class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Review Text</label>
              <textarea
                v-model="editing.review_text"
                rows="3"
                placeholder="The customer's original review..."
                class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Google Review Link</label>
              <input
                v-model="editing.link"
                type="url"
                placeholder="https://..."
                class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div class="flex justify-center pt-1">
              <button
                type="button"
                :disabled="generating || !editing.reviewer_name || !editing.review_text || !editing.rating"
                class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                @click="generateResponses"
              >
                <Loader2 v-if="generating" class="w-4 h-4 animate-spin" />
                <Sparkles v-else class="w-4 h-4" />
                {{ generating ? 'Generating...' : 'Generate with AI' }}
              </button>
            </div>

            <div v-for="{ key, label } in responseLabels" :key="key">
              <label class="block text-xs font-medium text-text-secondary mb-1.5">{{ label }} Response</label>
              <textarea
                v-model="editing[key]"
                rows="3"
                :placeholder="`${label} tone response...`"
                class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button
              class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-warm transition-colors"
              @click="editing = null"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all disabled:opacity-50 flex items-center gap-2"
              :disabled="saving"
              @click="handleSave"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Promo code edit modal -->
    <Teleport to="body">
      <div
        v-if="editingPromo"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
        @click.self="editingPromo = null"
      >
        <div class="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <p class="text-sm font-bold font-display">{{ editingPromo.isNew ? 'Create' : 'Edit' }} Promo Code</p>
            <button class="p-1.5 hover:bg-surface-warm rounded-lg transition-colors" @click="editingPromo = null">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Code</label>
              <input
                v-model="editingPromo.code"
                type="text"
                placeholder="e.g. LAUNCH30"
                :readonly="!editingPromo.isNew"
                class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-mono uppercase"
                :class="!editingPromo.isNew ? 'bg-surface-warm text-text-muted cursor-not-allowed' : ''"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-text-secondary mb-1.5">Duration (days)</label>
                <input
                  v-model.number="editingPromo.durationDays"
                  type="number"
                  min="1"
                  placeholder="30"
                  class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-secondary mb-1.5">Max uses <span class="text-text-muted font-normal">(leave blank for unlimited)</span></label>
                <input
                  v-model="editingPromo.maxUses"
                  type="number"
                  min="1"
                  placeholder="∞"
                  class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-text-secondary mb-1.5">Expires on <span class="text-text-muted font-normal">(leave blank = never)</span></label>
              <input
                v-model="editingPromo.expiresAt"
                type="date"
                class="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div class="flex items-center justify-between py-1">
              <div>
                <p class="text-xs font-medium text-text-secondary">Active</p>
                <p class="text-[10px] text-text-muted">Inactive codes cannot be redeemed</p>
              </div>
              <button
                class="transition-colors"
                @click="editingPromo.isActive = !editingPromo.isActive"
              >
                <ToggleRight v-if="editingPromo.isActive" class="w-8 h-8 text-success" />
                <ToggleLeft v-else class="w-8 h-8 text-text-muted" />
              </button>
            </div>

            <p v-if="promoError" class="text-xs text-error">{{ promoError }}</p>
          </div>

          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button
              class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-warm transition-colors"
              @click="editingPromo = null"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-all disabled:opacity-50 flex items-center gap-2"
              :disabled="savingPromo"
              @click="handleSavePromo"
            >
              <Loader2 v-if="savingPromo" class="w-4 h-4 animate-spin" />
              {{ savingPromo ? 'Saving...' : editingPromo.isNew ? 'Create' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
