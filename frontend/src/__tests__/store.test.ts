/**
 * TDD: Zustand store 검증
 */
import { describe, test, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/app.store'

describe('AppStore', () => {
  beforeEach(() => {
    // 스토어 초기화
    useAppStore.setState({
      currentMission: null,
      agents: [],
      pendingApprovals: 0,
    })
  })

  test('초기 상태가 올바르게 설정된다', () => {
    const state = useAppStore.getState()
    expect(state.currentMission).toBeNull()
    expect(state.agents).toEqual([])
    expect(state.pendingApprovals).toBe(0)
  })

  test('setCurrentMission으로 미션 설정', () => {
    const mission = { id: 'm-1', name: 'AI 학습 앱', description: '테스트', created_at: '2026-04-04' }
    useAppStore.getState().setCurrentMission(mission)
    expect(useAppStore.getState().currentMission).toEqual(mission)
  })

  test('setCurrentMission(null)로 미션 초기화', () => {
    const mission = { id: 'm-1', name: '테스트', description: '', created_at: '2026-04-04' }
    useAppStore.getState().setCurrentMission(mission)
    useAppStore.getState().setCurrentMission(null)
    expect(useAppStore.getState().currentMission).toBeNull()
  })

  test('setAgents로 봇 목록 설정', () => {
    const agents = [
      {
        id: 'a-1', mission_id: 'm-1', name: 'Research Bot', role: 'research' as const,
        schedule: 'manual' as const, system_prompt: '', budget_cents: 1000,
        is_active: true, reports_to: null, created_at: '2026-04-04',
      },
    ]
    useAppStore.getState().setAgents(agents)
    expect(useAppStore.getState().agents).toHaveLength(1)
    expect(useAppStore.getState().agents[0]?.name).toBe('Research Bot')
  })

  test('setPendingApprovals로 승인 대기 수 설정', () => {
    useAppStore.getState().setPendingApprovals(5)
    expect(useAppStore.getState().pendingApprovals).toBe(5)
  })

  test('setPendingApprovals(0)으로 초기화', () => {
    useAppStore.getState().setPendingApprovals(3)
    useAppStore.getState().setPendingApprovals(0)
    expect(useAppStore.getState().pendingApprovals).toBe(0)
  })
})
