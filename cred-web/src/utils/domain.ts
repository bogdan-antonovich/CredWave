import { config } from '@/config/env'

export const isDashboardDomain: boolean = (() => {
  if (typeof window === 'undefined') return false
  if (!config.dashboardUrl) return false
  try {
    return window.location.hostname === new URL(config.dashboardUrl).hostname
  } catch {
    return false
  }
})()
