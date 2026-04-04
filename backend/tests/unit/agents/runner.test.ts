/**
 * TDD: Agent Runner — Claude Code CLI subprocess 실행
 * Paperclip 검증 방식: spawn("claude", ["--print", "-", "--output-format", "stream-json"])
 */
import { AgentRunner } from '../../../src/agents/runner';
import type { Agent } from '../../../src/db/types';

const mockAgent: Agent = {
  id: 'agent-1',
  mission_id: 'mission-1',
  name: 'Research Bot',
  role: 'research',
  schedule: 'manual',
  system_prompt: '너는 리서치 봇이다. 주어진 주제를 조사하고 결과를 보고해라.',
  budget_cents: 5000,
  is_active: true,
  reports_to: null,
  created_at: '2026-04-04T00:00:00.000Z',
};

describe('AgentRunner', () => {
  let runner: AgentRunner;
  const mockEmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new AgentRunner({ emit: mockEmit } as any);
  });

  test('buildPrompt()는 system_prompt + mission context를 포함한다', () => {
    const prompt = runner.buildPrompt(mockAgent, '경쟁사 분석 해줘', { missionName: 'AI 스타트업 런칭' });
    expect(prompt).toContain(mockAgent.system_prompt);
    expect(prompt).toContain('AI 스타트업 런칭');
    expect(prompt).toContain('경쟁사 분석 해줘');
  });

  test('buildPrompt()는 OOMNI_API_URL 환경변수 지시를 포함한다', () => {
    const prompt = runner.buildPrompt(mockAgent, '작업 시작', {});
    expect(prompt).toContain('OOMNI_API_URL');
    expect(prompt).toContain('OOMNI_AGENT_ID');
  });

  test('buildPrompt()는 봇 역할에 따라 다른 지시를 포함한다', () => {
    const researchPrompt = runner.buildPrompt(mockAgent, '조사해줘', {});
    const buildAgent = { ...mockAgent, role: 'build' as const };
    const buildPrompt = runner.buildPrompt(buildAgent, '코딩해줘', {});
    expect(researchPrompt).not.toBe(buildPrompt);
  });

  test('parseStreamOutput()는 stream-json 청크를 파싱한다', () => {
    const chunk = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: '분석 완료: GPT-4 대비 강점은...' }] }
    });
    const result = runner.parseStreamOutput(chunk);
    expect(result).toBe('분석 완료: GPT-4 대비 강점은...');
  });

  test('parseStreamOutput()는 result 타입에서 비용을 추출한다', () => {
    const chunk = JSON.stringify({
      type: 'result',
      usage: { input_tokens: 1000, output_tokens: 500 },
      cost_usd: 0.0045
    });
    const result = runner.parseStreamOutput(chunk);
    expect(result).toBeNull(); // text 없음
  });

  test('extractCost()는 result 청크에서 cost_usd를 추출한다', () => {
    const resultChunk = JSON.stringify({
      type: 'result',
      usage: { input_tokens: 1000, output_tokens: 500 },
      cost_usd: 0.0045
    });
    const cost = runner.extractCost(resultChunk);
    expect(cost).toEqual({ input_tokens: 1000, output_tokens: 500, cost_usd: 0.0045 });
  });

  test('extractCost()는 result 타입이 아니면 null을 반환한다', () => {
    const chunk = JSON.stringify({ type: 'assistant', message: {} });
    expect(runner.extractCost(chunk)).toBeNull();
  });

  test('buildEnv()는 보안 환경변수를 포함한다', () => {
    const env = runner.buildEnv(mockAgent, 'http://localhost:3001', 'oomni-secret-key');
    expect(env.OOMNI_API_URL).toBe('http://localhost:3001');
    expect(env.OOMNI_AGENT_ID).toBe(mockAgent.id);
    expect(env.OOMNI_API_KEY).toBe('oomni-secret-key');
    // ANTHROPIC_API_KEY는 봇 prompt에서 언급하지 않음 (봇이 직접 Claude 호출 불가)
    // OOMNI_API_KEY를 통해서만 OOMNI 서버와 통신
    expect(env.OOMNI_AGENT_ID).toBe(mockAgent.id);
  });
});
