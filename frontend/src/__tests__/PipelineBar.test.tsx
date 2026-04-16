/**
 * TDD: PipelineBar 스테이지 이벤트 실시간 업데이트 테스트 (3-A-4)
 */
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PipelineBar, ROLE_STAGES } from '../components/bot/PipelineBar'

describe('PipelineBar', () => {
  test('ROLE_STAGES에 모든 Chat 봇 역할이 정의되어 있다', () => {
    const chatRoles = ['research', 'content', 'growth', 'ops', 'ceo']
    for (const role of chatRoles) {
      expect(ROLE_STAGES[role], `${role} 역할의 스테이지가 없음`).toBeDefined()
      expect(ROLE_STAGES[role]?.length).toBeGreaterThan(0)
    }
  })

  test('ROLE_STAGES에 PTY 봇 역할(build/design)이 정의되어 있다', () => {
    const ptyRoles = ['build', 'design']
    for (const role of ptyRoles) {
      expect(ROLE_STAGES[role], `${role} 역할의 스테이지가 없음`).toBeDefined()
    }
  })

  test('스테이지 배열로 렌더링 에러 없음', () => {
    const stages = ROLE_STAGES['research']!
    expect(() =>
      render(<PipelineBar stages={stages} currentStage={stages[0]!.key} />)
    ).not.toThrow()
  })

  test('currentStage=null일 때 렌더링 에러 없음', () => {
    const stages = ROLE_STAGES['research']!
    expect(() =>
      render(<PipelineBar stages={stages} currentStage={null} />)
    ).not.toThrow()
  })

  test('빈 stages 배열도 크래시하지 않는다', () => {
    expect(() =>
      render(<PipelineBar stages={[]} currentStage={null} />)
    ).not.toThrow()
  })

  test('research 봇 스테이지가 collecting → sorting 포함', () => {
    const stages = ROLE_STAGES['research']!
    const keys = stages.map(s => s.key)
    expect(keys[0]).toBe('collecting')
    expect(keys).toContain('sorting')
  })

  test('done 스테이지가 Chat 봇 모든 역할에 존재한다', () => {
    const roles = ['research', 'content', 'growth', 'ops', 'ceo']
    for (const role of roles) {
      const stages = ROLE_STAGES[role]
      expect(stages?.some(s => s.key === 'done'), `${role}에 done 스테이지 없음`).toBe(true)
    }
  })

  test('각 스테이지가 key와 label을 가진다', () => {
    for (const [role, stages] of Object.entries(ROLE_STAGES)) {
      for (const stage of stages) {
        expect(stage.key, `${role} 스테이지에 key 없음`).toBeTruthy()
        expect(stage.label, `${role} 스테이지에 label 없음`).toBeTruthy()
      }
    }
  })
})
