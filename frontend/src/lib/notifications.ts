export function notify(title: string, body: string, urgency?: 'normal' | 'critical' | 'low') {
  try {
    (window as any).electronAPI?.showNotification?.({ title, body, urgency })
  } catch {}
}

// Call this when a new approval comes in via WebSocket
export function notifyApprovalRequired(agentName: string) {
  notify('승인 요청', `${agentName}이 승인을 요청했습니다`, 'critical')
}

export function notifyBotComplete(agentName: string, success: boolean) {
  notify(
    success ? '봇 실행 완료' : '봇 실행 오류',
    `${agentName} ${success ? '작업을 완료했습니다' : '실행 중 오류가 발생했습니다'}`,
    success ? 'normal' : 'critical'
  )
}
