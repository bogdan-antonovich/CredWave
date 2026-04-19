import { onMounted, onUnmounted } from 'vue'

export function useReveal() {
  let intersectionObserver: IntersectionObserver | null = null
  let mutationObserver: MutationObserver | null = null

  function observe(el: Element) {
    if (el.classList.contains('visible')) return
    intersectionObserver?.observe(el)
  }

  function scanAndObserve(root: Element | Document = document) {
    root.querySelectorAll('.reveal').forEach(observe)
  }

  onMounted(() => {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            intersectionObserver?.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    // Observe everything already in the DOM
    scanAndObserve()

    // Watch for dynamically added .reveal elements
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            if (node.classList.contains('reveal')) observe(node)
            scanAndObserve(node)
          }
        }
      }
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  })

  onUnmounted(() => {
    intersectionObserver?.disconnect()
    mutationObserver?.disconnect()
  })
}
