// LiveStreamDrawer — v3.0 stub (기능 제거됨)
import type { RefObject } from 'react'
import type { ModelId } from './ModelSwitcher'

interface LiveStreamDrawerProps {
  agentId: string
  task: string
  isRunning: boolean
  onStageChange?: (stage: string) => void
  onDone?: () => void
  onError?: () => void
  onOutputChunk?: (chunk: string) => void
  onScreenshot?: (url: string) => void
  esRef?: RefObject<EventSource | null>
  modelId?: ModelId
  apiKeys?: Record<string, string>
}

export function LiveStreamDrawer(_props: LiveStreamDrawerProps) {
  return null
}
