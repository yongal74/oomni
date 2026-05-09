/**
 * analytics.ts — Sentry 에러 추적 + PostHog 사용 분석
 * VITE_SENTRY_DSN 또는 VITE_POSTHOG_KEY 환경변수가 없으면 조용히 비활성화
 */
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

let sentryReady = false
let posthogReady = false

export function initAnalytics() {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {}

  // ── Sentry ──────────────────────────────────────────────
  const sentryDsn = env['VITE_SENTRY_DSN']
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: env['MODE'] ?? 'production',
      tracesSampleRate: 0.1,
      integrations: [],
    })
    sentryReady = true
  }

  // ── PostHog ──────────────────────────────────────────────
  const posthogKey  = env['VITE_POSTHOG_KEY']
  const posthogHost = env['VITE_POSTHOG_HOST']
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost ?? 'https://app.posthog.com',
      capture_pageview: false,
      autocapture: false,
      loaded: () => { posthogReady = true },
    })
  }
}

export function trackPage(path: string) {
  if (posthogReady) posthog.capture('$pageview', { path })
}

export function trackEvent(event: string, props?: Record<string, unknown>) {
  if (posthogReady) posthog.capture(event, props)
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (posthogReady) posthog.identify(userId, traits)
  if (sentryReady) Sentry.setUser({ id: userId })
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (sentryReady) {
    if (context) Sentry.setContext('extra', context)
    Sentry.captureException(err)
  }
}

export { Sentry }
