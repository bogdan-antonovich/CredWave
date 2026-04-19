<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
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
import {
  getAllRestaurantNames,
  getDemoBlocks,
  upsertReviewBlock,
  deleteReviewBlock,
} from '@/services/demo.service'
import type { ReviewBlock } from '@/types/demo.types'

const router = useRouter()
const authStore = useAuthStore()

// ── Restaurant pages ──
const restaurants = ref<string[]>([])
const selectedRestaurant = ref('')
const showNewRestaurant = ref(false)
const newRestaurantName = ref('')
const newRestaurantError = ref<string | null>(null)

// ── Review blocks for selected restaurant ──
const blocks = ref<ReviewBlock[]>([])
const loadingBlocks = ref(false)

// ── Edit modal ──
const editing = ref<ReviewBlock | null>(null)
const saving = ref(false)

// ── URL ──
const demoUrl = computed(() => {
  if (!selectedRestaurant.value) return ''
  return `/demo/${selectedRestaurant.value}`
})

const urlCopied = ref(false)

// ── Init ──
onMounted(async () => {
  restaurants.value = await getAllRestaurantNames()
  if (restaurants.value.length > 0) {
    selectedRestaurant.value = restaurants.value[0]
    await loadBlocks()
  }
})

// ── Restaurant CRUD ──
function createRestaurant() {
  newRestaurantError.value = null
  const raw = newRestaurantName.value.trim()
  if (raw.length < 2) {
    newRestaurantError.value = 'Name must be at least 2 characters'
    return
  }

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  if (restaurants.value.includes(slug)) {
    newRestaurantError.value = 'This restaurant page already exists'
    return
  }

  restaurants.value.push(slug)
  selectedRestaurant.value = slug
  blocks.value = []
  showNewRestaurant.value = false
  newRestaurantName.value = ''
}

async function deleteRestaurant(slug: string) {
  if (!confirm(`Delete "${slug}" and all its review blocks?`)) return

  // Delete all blocks for this restaurant from Supabase
  for (const block of blocks.value) {
    try {
      await deleteReviewBlock(block.id)
    } catch {
      // continue
    }
  }

  restaurants.value = restaurants.value.filter((r) => r !== slug)

  if (selectedRestaurant.value === slug) {
    selectedRestaurant.value = restaurants.value[0] || ''
    if (selectedRestaurant.value) {
      await loadBlocks()
    } else {
      blocks.value = []
    }
  }
}

async function selectRestaurant(slug: string) {
  selectedRestaurant.value = slug
  await loadBlocks()
}

// ── Block CRUD ──
async function loadBlocks() {
  if (!selectedRestaurant.value) return
  loadingBlocks.value = true
  try {
    blocks.value = await getDemoBlocks(selectedRestaurant.value)
  } catch {
    blocks.value = []
  } finally {
    loadingBlocks.value = false
  }
}

function startEdit(block?: ReviewBlock) {
  editing.value = block
    ? { ...block }
    : {
        id: crypto.randomUUID(),
        restaurant_name: selectedRestaurant.value,
        reviewer_name: '',
        review_text: '',
        rating: 5,
        response_a: '',
        response_b: '',
        response_c: '',
      }
}

async function handleSave() {
  if (!editing.value) return
  saving.value = true
  try {
    const saved = await upsertReviewBlock(editing.value)
    // If Supabase isn't connected, add/update locally
    if (!saved) {
      const idx = blocks.value.findIndex((b) => b.id === editing.value!.id)
      if (idx >= 0) {
        blocks.value[idx] = { ...editing.value! }
      } else {
        blocks.value.push({ ...editing.value! })
      }
    } else {
      await loadBlocks()
    }
    editing.value = null
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function handleDeleteBlock(id: string) {
  if (!confirm('Delete this review block?')) return
  try {
    await deleteReviewBlock(id)
  } catch {
    // If Supabase isn't connected, remove locally
  }
  blocks.value = blocks.value.filter((b) => b.id !== id)
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.origin + demoUrl.value)
    urlCopied.value = true
    setTimeout(() => { urlCopied.value = false }, 2000)
  } catch { /* */ }
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

const responseLabels: Record<string, string> = {
  response_a: 'Empathetic',
  response_b: 'Professional',
  response_c: 'Casual',
}
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
      <!-- ═══ Sidebar: Restaurant Pages ═══ -->
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
          <input
            v-model="newRestaurantName"
            type="text"
            placeholder="Restaurant name"
            class="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent mb-2"
            @keydown.enter="createRestaurant"
          />
          <p v-if="newRestaurantError" class="text-xs text-error mb-2">{{ newRestaurantError }}</p>
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-subtle transition-colors"
              @click="createRestaurant"
            >
              Create Page
            </button>
            <button
              class="px-3 py-1.5 text-xs text-text-muted border border-border rounded-lg hover:bg-surface-warm transition-colors"
              @click="showNewRestaurant = false; newRestaurantName = ''"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Restaurant list -->
        <div class="space-y-1">
          <div
            v-for="name in restaurants"
            :key="name"
            class="group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
            :class="name === selectedRestaurant
              ? 'bg-white border border-border shadow-sm'
              : 'hover:bg-white/60'"
            @click="selectRestaurant(name)"
          >
            <Store
              class="w-4 h-4 shrink-0"
              :class="name === selectedRestaurant ? 'text-accent' : 'text-text-muted'"
            />
            <span
              class="flex-1 text-sm font-medium truncate capitalize"
              :class="name === selectedRestaurant ? 'text-text-primary' : 'text-text-secondary'"
            >
              {{ name.replace(/-/g, ' ') }}
            </span>
            <button
              class="p-1 rounded-md opacity-0 group-hover:opacity-100 text-text-muted hover:text-error hover:bg-error/5 transition-all"
              title="Delete restaurant page"
              @click.stop="deleteRestaurant(name)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="restaurants.length === 0" class="text-center py-8 text-xs text-text-muted">
            No restaurant pages yet.<br />Click + to create one.
          </div>
        </div>
      </aside>

      <!-- ═══ Main: Review Blocks ═══ -->
      <main class="flex-1 min-w-0">
        <template v-if="selectedRestaurant">
          <!-- Restaurant header -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-bold font-display text-text-primary capitalize">
                {{ selectedRestaurant.replace(/-/g, ' ') }}
              </h2>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-xs text-text-muted">{{ blocks.length }} review block{{ blocks.length !== 1 ? 's' : '' }}</span>
                <span class="text-xs text-text-muted">·</span>
                <div class="flex items-center gap-1.5">
                  <code class="text-xs text-accent bg-accent/5 px-2 py-0.5 rounded">{{ demoUrl }}</code>
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

          <!-- Loading -->
          <div v-if="loadingBlocks" class="flex justify-center py-20">
            <Loader2 class="w-5 h-5 animate-spin text-text-muted" />
          </div>

          <!-- Block list -->
          <div v-else class="space-y-3">
            <div
              v-for="block in blocks"
              :key="block.id"
              class="bg-white border border-border-subtle rounded-xl overflow-hidden"
            >
              <!-- Block header row -->
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

              <!-- Review text -->
              <div class="px-5 py-3">
                <p class="text-sm text-text-secondary leading-relaxed">{{ block.review_text }}</p>
              </div>

              <!-- Responses preview -->
              <div class="px-5 pb-4 flex gap-2">
                <div
                  v-for="(displayLabel, fieldKey) in responseLabels"
                  :key="fieldKey"
                  class="flex-1 p-2.5 rounded-lg bg-surface-warm"
                >
                  <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">{{ displayLabel }}</p>
                  <p class="text-xs text-text-secondary line-clamp-2">{{ (block as any)[fieldKey] }}</p>
                </div>
              </div>
            </div>

            <!-- Empty state -->
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

        <!-- No restaurant selected -->
        <div v-else class="text-center py-20">
          <Store class="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p class="text-sm font-medium text-text-primary">No restaurant selected</p>
          <p class="text-xs text-text-muted mt-1">Create a restaurant page from the sidebar to get started.</p>
        </div>
      </main>
    </div>

    <!-- ═══ Edit Modal ═══ -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
        @click.self="editing = null"
      >
        <div class="w-full max-w-[640px] bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <p class="text-sm font-bold font-display">{{ editing.reviewer_name ? 'Edit' : 'New' }} Review Block</p>
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

            <div v-for="(displayLabel, fieldKey) in responseLabels" :key="fieldKey">
              <label class="block text-xs font-medium text-text-secondary mb-1.5">{{ displayLabel }} Response</label>
              <textarea
                v-model="(editing as any)[fieldKey]"
                rows="3"
                :placeholder="`${displayLabel} tone response...`"
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
