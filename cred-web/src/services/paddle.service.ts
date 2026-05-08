import { config } from '@/config/env'

declare global {
  interface Window {
    Paddle?: {
      Environment: {
        set: (env: string) => void
      }
      Initialize: (opts: { token: string }) => void
      Checkout: {
        open: (opts: { items: { priceId: string; quantity: number }[] }) => void
      }
    }
  }
}

let initialized = false

export function initPaddle(): void {
  if (initialized || !config.paddle.vendorId) return

  const script = document.createElement('script')
  script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
  script.async = true
  script.onload = () => {
    if (window.Paddle) {
      if (config.paddle.environment === 'sandbox') {
        window.Paddle.Environment.set('sandbox')
      }
      window.Paddle.Initialize({ token: config.paddle.vendorId })
      initialized = true
    }
  }
  document.head.appendChild(script)
}

export function waitForPaddle(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Paddle) { resolve(); return }
    const start = Date.now()
    const interval = setInterval(() => {
      if (window.Paddle) { clearInterval(interval); resolve() }
      else if (Date.now() - start > timeoutMs) { clearInterval(interval); reject(new Error('Paddle load timeout')) }
    }, 100)
  })
}

export function openCheckout(priceId: string): void {
  if (!window.Paddle) {
    console.warn('Paddle not initialized')
    return
  }
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
  })
}
