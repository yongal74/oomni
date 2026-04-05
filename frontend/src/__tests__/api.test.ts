/**
 * TDD: API 클라이언트 타입 및 구조 검증
 */
import { describe, test, expect } from 'vitest'

// api.ts에서 내보내는 API 함수/타입이 올바르게 정의되어 있는지 검증
describe('API 클라이언트', () => {
  test('missionsApi 함수들이 정의되어 있다', async () => {
    const { missionsApi } = await import('../lib/api')
    expect(typeof missionsApi.list).toBe('function')
    expect(typeof missionsApi.create).toBe('function')
    expect(typeof missionsApi.get).toBe('function')
  })

  test('agentsApi 함수들이 정의되어 있다', async () => {
    const { agentsApi } = await import('../lib/api')
    expect(typeof agentsApi.list).toBe('function')
    expect(typeof agentsApi.create).toBe('function')
    expect(typeof agentsApi.update).toBe('function')
    expect(typeof agentsApi.trigger).toBe('function')
    expect(typeof agentsApi.delete).toBe('function')
  })

  test('issuesApi 함수들이 정의되어 있다', async () => {
    const { issuesApi } = await import('../lib/api')
    expect(typeof issuesApi.list).toBe('function')
    expect(typeof issuesApi.create).toBe('function')
    expect(typeof issuesApi.update).toBe('function')
    expect(typeof issuesApi.delete).toBe('function')
  })

  test('schedulesApi 함수들이 정의되어 있다', async () => {
    const { schedulesApi } = await import('../lib/api')
    expect(typeof schedulesApi.list).toBe('function')
    expect(typeof schedulesApi.create).toBe('function')
    expect(typeof schedulesApi.update).toBe('function')
    expect(typeof schedulesApi.delete).toBe('function')
  })

  test('reportsApi 함수들이 정의되어 있다', async () => {
    const { reportsApi } = await import('../lib/api')
    expect(typeof reportsApi.get).toBe('function')
  })

  test('researchApi 함수들이 정의되어 있다', async () => {
    const { researchApi } = await import('../lib/api')
    expect(typeof researchApi.list).toBe('function')
    expect(typeof researchApi.collect).toBe('function')
    expect(typeof researchApi.create).toBe('function')
    expect(typeof researchApi.filter).toBe('function')
    expect(typeof researchApi.convert).toBe('function')
    expect(typeof researchApi.delete).toBe('function')
  })

  test('feedApi 함수들이 정의되어 있다', async () => {
    const { feedApi } = await import('../lib/api')
    expect(typeof feedApi.list).toBe('function')
    expect(typeof feedApi.approve).toBe('function')
    expect(typeof feedApi.reject).toBe('function')
  })

  test('costApi 함수들이 정의되어 있다', async () => {
    const { costApi } = await import('../lib/api')
    expect(typeof costApi.summary).toBe('function')
  })

  test('integrationsApi 함수들이 정의되어 있다', async () => {
    const { integrationsApi } = await import('../lib/api')
    expect(typeof integrationsApi.list).toBe('function')
    expect(typeof integrationsApi.providers).toBe('function')
    expect(typeof integrationsApi.save).toBe('function')
    expect(typeof integrationsApi.delete).toBe('function')
  })
})
