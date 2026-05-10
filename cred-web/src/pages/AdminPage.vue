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
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/services/api'

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

const router = useRouter()
const authStore = useAuthStore()

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

const urlCopied = ref(false)

const selectedRestaurant = computed(() =>
  restaurants.value.find((r) => r.slug === selectedSlug.value) ?? null,
)

const demoUrl = computed(() =>
  selectedSlug.value ? `/demo/${selectedSlug.value}` : '',
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
    await navigator.clipboard.writeText(window.location.origin + demoUrl.value)
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
</script>

<template>
  <div class="min-h-screen bg-surface-warm">
    <!-- Header -->
    <header class="bg-white border-b border-border-subtle">
      <div class="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand text-white text-xs font-extrabold font-display tracking-tight leading-none">CW</span>
          <p class="text-sm font-bold font-display">Admin</p>
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

    <div class="max-w-[1200px] mx-auto px-6 py-8 flex gap-8">
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
                  <RouterLink
                    :to="demoUrl"
                    target="_blank"
                    class="p-1 rounded text-text-muted hover:text-accent transition-colors"
                    title="Open demo page"
                  >
                    <ExternalLink class="w-3 h-3" />
                  </RouterLink>
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

    <!-- Edit modal -->
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
  </div>
</template>
