import posthog from 'posthog-js'
import { config } from '@/config/env'

const CONSENT_KEY = 'cw_cookie_consent'

export type CookieConsent = 'accepted' | 'declined' | null

export function getStoredConsent(): CookieConsent {
  return (localStorage.getItem(CONSENT_KEY) as CookieConsent) ?? null
}

export function initAnalytics() {
  if (!config.posthog.key) return

  posthog.init(config.posthog.key, {
    api_host: config.posthog.host,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    opt_out_capturing_by_default: getStoredConsent() !== 'accepted',
  })
}

export function acceptCookies() {
  localStorage.setItem(CONSENT_KEY, 'accepted')
  if (config.posthog.key) posthog.opt_in_capturing()
}

export function declineCookies() {
  localStorage.setItem(CONSENT_KEY, 'declined')
  if (config.posthog.key) posthog.opt_out_capturing()
}

export function identifyUser(id: string, props: { email: string; name: string }) {
  if (!config.posthog.key) return
  posthog.identify(String(id), props)
}

export function resetUser() {
  if (!config.posthog.key) return
  posthog.reset()
}

export function trackPageview(path: string) {
  if (!config.posthog.key || typeof window === 'undefined') return
  posthog.capture('$pageview', { $current_url: window.location.origin + path })
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!config.posthog.key) return
  posthog.capture(event, props)
}
