/**
 * remotion-entry.tsx — Entry point for Remotion bundler (headless rendering)
 * Registers compositions for backend rendering
 */
import { registerRoot, Composition } from 'remotion'
import { ShortFormVideo, type ShortFormVideoProps } from './ShortFormVideo'
import { GrowthStoryVideo, type GrowthStoryProps } from './GrowthStoryVideo'

// Default props for ShortFormVideo
const defaultShortFormProps: ShortFormVideoProps = {
  durationInFrames: 1800,
  fps: 30,
  width: 1080,
  height: 1920,
  slides: [
    {
      type: 'hook',
      startFrame: 0,
      durationInFrames: 90,
      content: '이 영상 끝까지 보면 인생이 달라집니다',
      backgroundColor: '#0A0A0F',
      textColor: '#A78BFA',
    },
    {
      type: 'problem',
      startFrame: 90,
      durationInFrames: 150,
      content: '매일 야근하지만 성과가 없죠',
      backgroundColor: '#0A0A0F',
      textColor: '#F87171',
    },
    {
      type: 'solution',
      startFrame: 240,
      durationInFrames: 510,
      content: ['AI 도구 세팅', '워크플로우 자동화', '집중 시간 확보'],
      backgroundColor: '#0A0A0F',
      textColor: '#34D399',
    },
    {
      type: 'proof',
      startFrame: 750,
      durationInFrames: 750,
      content: '3개월 만에 매출 300% 달성',
      backgroundColor: '#0A0A0F',
      textColor: '#60A5FA',
    },
    {
      type: 'cta',
      startFrame: 1500,
      durationInFrames: 300,
      content: '팔로우하고 다음 편 놓치지 마세요',
      backgroundColor: '#4F46E5',
      textColor: '#FFFFFF',
    },
  ],
}

// Default props for GrowthStoryVideo
const defaultGrowthProps: GrowthStoryProps = {
  metricType: 'users',
  startValue: 10,
  endValue: 1000,
  days: 30,
  brandName: 'OOMNI',
}

function Root() {
  return (
    <>
      <Composition
        id="ShortFormVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ShortFormVideo as any}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultShortFormProps}
      />
      <Composition
        id="GrowthStoryVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={GrowthStoryVideo as any}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultGrowthProps}
      />
    </>
  )
}

registerRoot(Root)
