// GrowthStoryVideo — v3.0 stub (기능 제거됨)
export type MetricType = 'users' | 'revenue' | 'signups' | 'mau' | 'mrr'

export interface GrowthStoryProps {
  metricType?: MetricType
  data?: unknown
  startValue?: number
  endValue?: number
  days?: number
  brandName?: string
}

export function GrowthStoryVideo(_props: GrowthStoryProps) {
  return null
}
