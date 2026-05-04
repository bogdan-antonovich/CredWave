<script setup lang="ts">
import { ref } from 'vue'
import { Send, Loader2, CheckCircle, Mail, MessageCircle } from 'lucide-vue-next'
import FooterSection from '@/components/layout/FooterSection.vue'
import { useReveal } from '@/utils/useReveal'
import { api } from '@/services/api'

useReveal()

const form = ref({
  name: '',
  email: '',
  message: '',
})

const sending = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  error.value = null

  if (!form.value.name.trim() || !form.value.email.trim() || !form.value.message.trim()) {
    error.value = 'All fields are required.'
    return
  }

  sending.value = true
  try {
    await api.post('/contact', form.value)
    sent.value = true
  } catch {
    error.value = 'Something went wrong. Please try again.'
  } finally {
    sending.value = false
  }
}

function reset() {
  sent.value = false
  form.value = { name: '', email: '', message: '' }
}
</script>

<template>
  <div class="min-h-screen bg-surface-warm flex flex-col">

    <main class="pt-14 flex-1">
      <section class="py-24 px-6">
        <div class="max-w-[1000px] mx-auto">
          <div class="reveal text-center mb-16">
            <h1 class="text-3xl md:text-[2.5rem] font-bold font-display tracking-tight text-text-primary">
              Got questions? Let's talk.
            </h1>
            <p class="mt-3 text-text-secondary text-lg max-w-[460px] mx-auto">
              Whether you're curious about features, pricing, or just want to say hi — we're here.
            </p>
          </div>

          <div class="reveal grid md:grid-cols-5 gap-12">
            <!-- Sidebar info -->
            <div class="md:col-span-2 space-y-8">
              <div>
                <div class="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center mb-3">
                  <Mail class="w-5 h-5 text-accent" />
                </div>
                <p class="font-semibold text-text-primary text-sm">Email us</p>
                <a href="mailto:hello@credwave.com" class="text-sm text-accent hover:underline">hello@credwave.com</a>
              </div>

              <div>
                <div class="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center mb-3">
                  <MessageCircle class="w-5 h-5 text-accent" />
                </div>
                <p class="font-semibold text-text-primary text-sm">Response time</p>
                <p class="text-sm text-text-secondary">We typically reply within 24 hours.</p>
              </div>
            </div>

            <!-- Form -->
            <div class="md:col-span-3">
              <div v-if="sent" class="text-center py-16">
                <CheckCircle class="w-10 h-10 text-success mx-auto mb-4" />
                <p class="text-lg font-semibold font-display text-text-primary">Message sent</p>
                <p class="mt-1 text-sm text-text-secondary">We'll get back to you within 24 hours.</p>
                <button
                  class="mt-6 text-sm text-accent font-medium hover:underline"
                  @click="reset"
                >
                  Send another message
                </button>
              </div>

              <div v-else class="space-y-5">
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                  <input
                    v-model="form.name"
                    type="text"
                    placeholder="Your name"
                    class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 shadow-sm"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
                  <input
                    v-model="form.email"
                    type="email"
                    placeholder="you@restaurant.com"
                    class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 shadow-sm"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1.5">Message</label>
                  <textarea
                    v-model="form.message"
                    rows="5"
                    placeholder="Tell us what's on your mind..."
                    class="w-full px-4 py-3 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 shadow-sm resize-none"
                  />
                </div>

                <p v-if="error" class="text-xs text-error">{{ error }}</p>

                <button
                  class="inline-flex items-center gap-2 px-6 py-3 bg-brand text-text-inverse text-sm font-semibold rounded-xl hover:bg-brand-subtle transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                  :disabled="sending"
                  @click="handleSubmit"
                >
                  <Loader2 v-if="sending" class="w-4 h-4 animate-spin" />
                  <Send v-else class="w-4 h-4" />
                  {{ sending ? 'Sending...' : 'Send message' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <FooterSection />
  </div>
</template>
