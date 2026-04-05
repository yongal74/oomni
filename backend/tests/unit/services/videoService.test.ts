/**
 * videoService.test.ts — TDD for Short-Form Video Automation
 */
import path from 'path'
import fs from 'fs'
import os from 'os'

// Mock Anthropic SDK before importing the service
const mockCreate = jest.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        title: '테스트 숏폼 스크립트',
        variants: [
          {
            hook: '당신의 생산성이 10배 오르는 비결?',
            problem: '매일 야근하지만 성과가 없죠',
            solution: ['첫째, AI 도구 활용', '둘째, 자동화 설정', '셋째, 집중 시간 블록'],
            proof: '이 방법으로 3개월만에 매출 300% 달성',
            cta: '팔로우하고 내일 2편 놓치지 마세요',
          },
          {
            hook: '아직도 수동으로 하고 있나요?',
            problem: '반복 업무에 시간을 낭비하고 있다면',
            solution: ['자동화 도구 세팅', '워크플로우 최적화', '결과 측정 및 반복'],
            proof: '1000명의 솔로프리너가 검증한 방법',
            cta: '저장해두고 나중에 실천하세요',
          },
          {
            hook: '월 1000만원 버는 1인 기업의 하루',
            problem: '혼자서 모든 걸 하기엔 시간이 부족',
            solution: ['핵심 업무 집중', 'AI 에이전트 위임', '시스템 구축'],
            proof: '6개월 만에 퇴사 후 연봉 2배',
            cta: '공유하면 더 많은 사람이 혜택 받아요',
          },
        ],
      }),
    },
  ],
  usage: { input_tokens: 100, output_tokens: 500 },
})

function MockAnthropic() {
  return {
    messages: {
      create: mockCreate,
    },
  }
}

jest.mock('@anthropic-ai/sdk', () => {
  return MockAnthropic
})

// Use temp dir for file operations in tests
const TEST_VIDEO_DIR = path.join(os.tmpdir(), 'oomni-test-videos')
const TEST_VREW_DIR = path.join(TEST_VIDEO_DIR, 'vrew')

jest.mock('../../../src/services/videoService', () => {
  const original = jest.requireActual('../../../src/services/videoService')
  return {
    ...original,
    VIDEO_DIR: TEST_VIDEO_DIR,
    VREW_DIR: TEST_VREW_DIR,
  }
})

import {
  generateScript,
  saveVrewScript,
  scriptToRemotionProps,
  getVideoList,
} from '../../../src/services/videoService'

beforeAll(() => {
  fs.mkdirSync(TEST_VIDEO_DIR, { recursive: true })
  fs.mkdirSync(TEST_VREW_DIR, { recursive: true })
})

afterAll(() => {
  fs.rmSync(TEST_VIDEO_DIR, { recursive: true, force: true })
})

describe('videoService', () => {
  // ─── Test 1: generateScript returns script with hook/problem/solution/proof/cta ───
  describe('generateScript(topic, type)', () => {
    it('returns a ShortFormScript with all required fields', async () => {
      const script = await generateScript('AI 생산성 도구', 'content')

      expect(script).toBeDefined()
      expect(script.id).toBeDefined()
      expect(typeof script.id).toBe('string')
      expect(script.topic).toBe('AI 생산성 도구')
      expect(script.type).toBe('content')
      expect(script.title).toBeDefined()
      expect(script.created_at).toBeDefined()
    })

    it('each variant has hook, problem, solution, proof, cta', async () => {
      const script = await generateScript('AI 생산성 도구', 'content')

      expect(script.variants).toBeDefined()
      expect(Array.isArray(script.variants)).toBe(true)
      expect(script.variants.length).toBeGreaterThan(0)

      const variant = script.variants[0]
      expect(variant.hook).toBeDefined()
      expect(typeof variant.hook).toBe('string')
      expect(variant.hook.length).toBeGreaterThan(0)

      expect(variant.problem).toBeDefined()
      expect(typeof variant.problem).toBe('string')

      expect(variant.solution).toBeDefined()
      expect(Array.isArray(variant.solution)).toBe(true)
      expect(variant.solution.length).toBeGreaterThan(0)

      expect(variant.proof).toBeDefined()
      expect(typeof variant.proof).toBe('string')

      expect(variant.cta).toBeDefined()
      expect(typeof variant.cta).toBe('string')
    })

    it('works with growth type', async () => {
      const script = await generateScript('MAU 성장 전략', 'growth')
      expect(script.type).toBe('growth')
      expect(script.topic).toBe('MAU 성장 전략')
    })
  })

  // ─── Test 2: generateScript returns 3 variants ───────────────────────────────────
  describe('generateScript() - 3 variants', () => {
    it('returns exactly 3 script variants', async () => {
      const script = await generateScript('솔로프리너 팁', 'content')

      expect(script.variants).toHaveLength(3)
    })

    it('each variant has unique hook text', async () => {
      const script = await generateScript('솔로프리너 팁', 'content')

      const hooks = script.variants.map(v => v.hook)
      const uniqueHooks = new Set(hooks)
      expect(uniqueHooks.size).toBe(3)
    })
  })

  // ─── Test 3: saveVrewScript saves .txt file ───────────────────────────────────────
  describe('saveVrewScript(script)', () => {
    it('saves a .txt file and returns file path', async () => {
      const script = await generateScript('Vrew 테스트', 'content')
      const filePath = await saveVrewScript(script, TEST_VREW_DIR)

      expect(filePath).toBeDefined()
      expect(filePath).toContain(script.id)
      expect(filePath.endsWith('.txt')).toBe(true)
    })

    it('the saved file contains vrew_text content', async () => {
      const script = await generateScript('Vrew 콘텐츠', 'content')
      const filePath = await saveVrewScript(script, TEST_VREW_DIR)

      expect(fs.existsSync(filePath)).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content.length).toBeGreaterThan(0)
      // Should contain the hook text
      const firstVariant = script.variants[0]
      expect(content).toContain(firstVariant.hook)
    })

    it('creates the directory if it does not exist', async () => {
      const newDir = path.join(os.tmpdir(), 'oomni-test-new-vrew')
      const script = await generateScript('신규 디렉토리 테스트', 'content')
      const filePath = await saveVrewScript(script, newDir)

      expect(fs.existsSync(filePath)).toBe(true)
      fs.rmSync(newDir, { recursive: true, force: true })
    })
  })

  // ─── Test 4: scriptToRemotionProps converts script to Remotion props ─────────────
  describe('scriptToRemotionProps(script)', () => {
    it('returns valid Remotion props for a script variant', async () => {
      const script = await generateScript('Remotion 테스트', 'content')
      const props = scriptToRemotionProps(script.variants[0])

      expect(props).toBeDefined()
      expect(props.durationInFrames).toBe(1800) // 30fps * 60s
      expect(props.fps).toBe(30)
      expect(props.width).toBe(1080)
      expect(props.height).toBe(1920)
      expect(props.slides).toBeDefined()
      expect(Array.isArray(props.slides)).toBe(true)
    })

    it('creates 5 slides (hook/problem/solution/proof/cta)', async () => {
      const script = await generateScript('슬라이드 테스트', 'content')
      const props = scriptToRemotionProps(script.variants[0])

      expect(props.slides).toHaveLength(5)
      const types = props.slides.map(s => s.type)
      expect(types).toContain('hook')
      expect(types).toContain('problem')
      expect(types).toContain('solution')
      expect(types).toContain('proof')
      expect(types).toContain('cta')
    })

    it('each slide has startFrame and durationInFrames', async () => {
      const script = await generateScript('슬라이드 구조 테스트', 'content')
      const props = scriptToRemotionProps(script.variants[0])

      props.slides.forEach(slide => {
        expect(slide.startFrame).toBeGreaterThanOrEqual(0)
        expect(slide.durationInFrames).toBeGreaterThan(0)
        expect(slide.content).toBeDefined()
      })
    })
  })

  // ─── Test 5: getVideoList returns list of rendered videos ────────────────────────
  describe('getVideoList()', () => {
    it('returns an array (empty if no videos rendered yet)', async () => {
      const list = await getVideoList(TEST_VIDEO_DIR)

      expect(Array.isArray(list)).toBe(true)
    })

    it('returns video metadata when mp4 files exist', async () => {
      // Create mock mp4 files
      const mockId1 = 'test-video-001'
      const mockId2 = 'test-video-002'
      fs.writeFileSync(path.join(TEST_VIDEO_DIR, `${mockId1}.mp4`), 'mock mp4 data')
      fs.writeFileSync(path.join(TEST_VIDEO_DIR, `${mockId2}.mp4`), 'mock mp4 data')

      const list = await getVideoList(TEST_VIDEO_DIR)

      expect(list.length).toBeGreaterThanOrEqual(2)

      const ids = list.map(v => v.id)
      expect(ids).toContain(mockId1)
      expect(ids).toContain(mockId2)

      // Each item should have metadata
      list.forEach(video => {
        expect(video.id).toBeDefined()
        expect(video.filename).toBeDefined()
        expect(video.path).toBeDefined()
        expect(video.created_at).toBeDefined()
        expect(typeof video.size_bytes).toBe('number')
      })
    })
  })
})
