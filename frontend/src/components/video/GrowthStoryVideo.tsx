/**
 * GrowthStoryVideo.tsx — Remotion composition for Growth Bot metrics videos
 * Shows real business metrics: DAU, MRR, revenue growth with animations
 */
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion'

// ─── Types ────────────────────────────────────────────────────────────────────
export type MetricType = 'users' | 'revenue' | 'signups' | 'mau' | 'mrr'

export interface GrowthStoryProps {
  metricType: MetricType
  startValue: number
  endValue: number
  days: number
  unit?: string           // e.g., '명', '만원', '%'
  milestones?: Milestone[]
  brandName?: string
}

export interface Milestone {
  day: number
  label: string
  value: number
}

// ─── Metric config ────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<MetricType, { label: string; color: string; unit: string; emoji: string }> = {
  users: { label: 'Users', color: '#A78BFA', unit: '명', emoji: '👥' },
  revenue: { label: 'Revenue', color: '#34D399', unit: '만원', emoji: '💰' },
  signups: { label: 'Signups', color: '#60A5FA', unit: '명', emoji: '✍️' },
  mau: { label: 'MAU', color: '#F59E0B', unit: '명', emoji: '📈' },
  mrr: { label: 'MRR', color: '#34D399', unit: '만원', emoji: '💎' },
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({
  from,
  to,
  frame,
  fps,
  color,
  unit,
}: {
  from: number
  to: number
  frame: number
  fps: number
  totalFrames?: number
  color: string
  unit: string
}) {
  const progress = spring({
    frame,
    fps,
    config: { damping: 25, stiffness: 60, mass: 1 },
    from: 0,
    to: 1,
  })

  const currentValue = Math.round(from + (to - from) * Math.min(progress, 1))

  return (
    <div style={{ textAlign: 'center' }}>
      <span
        style={{
          fontSize: 120,
          fontWeight: 900,
          color,
          textShadow: `0 0 60px ${color}66`,
          letterSpacing: '-3px',
        }}
      >
        {currentValue.toLocaleString('ko-KR')}
      </span>
      <span style={{ fontSize: 48, fontWeight: 700, color, marginLeft: 12 }}>
        {unit}
      </span>
    </div>
  )
}

// ─── Slide 1: Title / Intro ────────────────────────────────────────────────────
function TitleSlide({
  metricType,
  days,
  brandName,
}: {
  metricType: MetricType
  days: number
  brandName?: string
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const config = METRIC_CONFIG[metricType]

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
    from: 0.6,
    to: 1,
  })
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${config.color}1A 0%, transparent 65%)`,
        }}
      />

      <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 120, marginBottom: 24 }}>{config.emoji}</div>

        <div
          style={{
            fontSize: 36,
            color: config.color,
            fontWeight: 700,
            letterSpacing: '5px',
            marginBottom: 20,
          }}
        >
          {brandName ?? 'OOMNI'} 성장 스토리
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            marginBottom: 30,
          }}
        >
          {days}일 만에<br />
          <span style={{ color: config.color }}>{config.label}</span><br />
          얼마나 늘었을까?
        </div>

        <div
          style={{
            fontSize: 30,
            color: 'rgba(255,255,255,0.5)',
            fontWeight: 500,
          }}
        >
          Day 1 → Day {days}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Slide 2: Day 1 → Day N Timeline ─────────────────────────────────────────
function TimelineSlide({
  startValue,
  endValue,
  days,
  metricType,
}: {
  startValue: number
  endValue: number
  days: number
  metricType: MetricType
}) {
  const frame = useCurrentFrame()
  const config = METRIC_CONFIG[metricType]

  const lineWidth = interpolate(frame, [0, 60], [0, 100], { extrapolateRight: 'clamp' })
  const dotOpacity1 = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' })
  const dotOpacity2 = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' })
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      <div style={{ opacity, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 40,
            color: config.color,
            fontWeight: 700,
            letterSpacing: '3px',
            marginBottom: 60,
          }}
        >
          📅 성장 타임라인
        </div>

        {/* Timeline */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            padding: '0 40px',
            marginBottom: 80,
          }}
        >
          {/* Line */}
          <div
            style={{
              height: 6,
              backgroundColor: '#1A1A2E',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${lineWidth}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${config.color}66, ${config.color})`,
                borderRadius: 3,
              }}
            />
          </div>

          {/* Day 1 dot */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: -27,
              opacity: dotOpacity1,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: '#1A1A2E',
                border: `3px solid ${config.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: config.color,
                fontWeight: 700,
              }}
            >
              D1
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', marginTop: 12 }}>
              {startValue.toLocaleString('ko-KR')}{config.unit}
            </div>
          </div>

          {/* Day N dot */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: -27,
              opacity: dotOpacity2,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: config.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: '#0A0A0F',
                fontWeight: 900,
              }}
            >
              D{days}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: config.color, marginTop: 12 }}>
              {endValue.toLocaleString('ko-KR')}{config.unit}
            </div>
          </div>
        </div>

        {/* Growth ratio */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: config.color,
            textShadow: `0 0 40px ${config.color}66`,
            opacity: dotOpacity2,
          }}
        >
          {endValue > startValue
            ? `+${Math.round(((endValue - startValue) / startValue) * 100)}%`
            : `${Math.round(((endValue - startValue) / startValue) * 100)}%`
          }
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Slide 3: Counter Animation ────────────────────────────────────────────────
function CounterSlide({
  startValue,
  endValue,
  metricType,
}: {
  startValue: number
  endValue: number
  metricType: MetricType
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const config = METRIC_CONFIG[metricType]

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${config.color}1A 0%, transparent 60%)`,
        }}
      />

      <div style={{ opacity, textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>{config.emoji}</div>

        <div
          style={{
            fontSize: 36,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          최종 {config.label}
        </div>

        <AnimatedCounter
          from={startValue}
          to={endValue}
          frame={frame}
          fps={fps}
          color={config.color}
          unit={config.unit}
        />

        <div
          style={{
            marginTop: 30,
            fontSize: 40,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          시작: {startValue.toLocaleString('ko-KR')}{config.unit}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Slide 4: Revenue Bar Growing ─────────────────────────────────────────────
function GrowthBarSlide({
  startValue,
  endValue,
  metricType,
}: {
  startValue: number
  endValue: number
  metricType: MetricType
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const config = METRIC_CONFIG[metricType]

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  // Generate monthly data points for bar chart
  const months = 6
  const bars = Array.from({ length: months }, (_, i) => {
    const progress = i / (months - 1)
    const value = startValue + (endValue - startValue) * (progress ** 1.5)
    const barProgress = spring({
      frame: frame - i * 15,
      fps,
      config: { damping: 18, stiffness: 100 },
      from: 0,
      to: (value / endValue) * 100,
    })
    return { value: Math.round(value), barProgress, month: `M${i + 1}` }
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      <div style={{ opacity, width: '100%' }}>
        <div
          style={{
            fontSize: 40,
            color: config.color,
            fontWeight: 700,
            letterSpacing: '3px',
            marginBottom: 50,
            textAlign: 'center',
          }}
        >
          📊 월별 성장 추이
        </div>

        {/* Bar chart */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            height: 500,
            padding: '0 20px',
            borderBottom: '2px solid rgba(255,255,255,0.1)',
          }}
        >
          {bars.map((bar, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                flex: 1,
              }}
            >
              {/* Value label */}
              <div
                style={{
                  fontSize: 24,
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                }}
              >
                {bar.value.toLocaleString('ko-KR')}
              </div>

              {/* Bar */}
              <div
                style={{
                  width: '70%',
                  height: `${bar.barProgress}%`,
                  background: i === months - 1
                    ? `linear-gradient(180deg, ${config.color}, ${config.color}88)`
                    : `linear-gradient(180deg, ${config.color}88, ${config.color}44)`,
                  borderRadius: '8px 8px 0 0',
                  minHeight: 4,
                  boxShadow: i === months - 1 ? `0 0 20px ${config.color}66` : 'none',
                }}
              />

              {/* Month label */}
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.4)' }}>
                {bar.month}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Slide 5: CTA / Milestone callouts ────────────────────────────────────────
function MilestoneCTASlide({
  metricType,
  endValue,
  days,
  milestones,
}: {
  metricType: MetricType
  endValue: number
  days: number
  milestones?: Milestone[]
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const config = METRIC_CONFIG[metricType]

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
    from: 0.7,
    to: 1,
  })
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  const defaultMilestones: Milestone[] = milestones ?? [
    { day: Math.round(days * 0.1), label: '첫 반응', value: Math.round(endValue * 0.05) },
    { day: Math.round(days * 0.5), label: '성장 가속', value: Math.round(endValue * 0.3) },
    { day: days, label: '목표 달성!', value: endValue },
  ]

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0A0A0F 0%, ${config.color}33 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
          width: '100%',
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 20 }}>🎯</div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#FFFFFF',
            marginBottom: 50,
            lineHeight: 1.2,
          }}
        >
          {days}일 여정,<br />
          <span style={{ color: config.color }}>
            {endValue.toLocaleString('ko-KR')}{config.unit}
          </span> 달성!
        </div>

        {/* Key milestones */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            marginBottom: 50,
            textAlign: 'left',
          }}
        >
          {defaultMilestones.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: interpolate(
                  frame,
                  [i * 12, i * 12 + 20],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                ),
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  color: config.color,
                  fontWeight: 700,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                D{m.day}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: `${config.color}44`,
                }}
              />
              <div style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 28, color: config.color, fontWeight: 800 }}>
                {m.value.toLocaleString('ko-KR')}{config.unit}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            backgroundColor: config.color,
            color: '#0A0A0F',
            fontSize: 40,
            fontWeight: 900,
            padding: '24px 60px',
            borderRadius: 100,
            display: 'inline-block',
            boxShadow: `0 8px 40px ${config.color}66`,
          }}
        >
          나도 도전하기 💪
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Main GrowthStoryVideo Composition ───────────────────────────────────────
export function GrowthStoryVideo(props: GrowthStoryProps) {
  const {
    metricType,
    startValue,
    endValue,
    days,
    milestones,
    brandName,
  } = props

  // Slide timings (frames at 30fps)
  const TITLE_FRAMES = 90        // 3s
  const TIMELINE_FRAMES = 210    // 7s
  const COUNTER_FRAMES = 180     // 6s
  const BAR_FRAMES = 600         // 20s
  const CTA_FRAMES = 720         // 24s

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0F' }}>
      {/* Slide 1: Title */}
      <Sequence from={0} durationInFrames={TITLE_FRAMES} name="Title">
        <TitleSlide metricType={metricType} days={days} brandName={brandName} />
      </Sequence>

      {/* Slide 2: Timeline */}
      <Sequence from={TITLE_FRAMES} durationInFrames={TIMELINE_FRAMES} name="Timeline">
        <TimelineSlide
          startValue={startValue}
          endValue={endValue}
          days={days}
          metricType={metricType}
        />
      </Sequence>

      {/* Slide 3: Counter */}
      <Sequence from={TITLE_FRAMES + TIMELINE_FRAMES} durationInFrames={COUNTER_FRAMES} name="Counter">
        <CounterSlide
          startValue={startValue}
          endValue={endValue}
          metricType={metricType}
        />
      </Sequence>

      {/* Slide 4: Bar Chart */}
      <Sequence
        from={TITLE_FRAMES + TIMELINE_FRAMES + COUNTER_FRAMES}
        durationInFrames={BAR_FRAMES}
        name="BarChart"
      >
        <GrowthBarSlide
          startValue={startValue}
          endValue={endValue}
          metricType={metricType}
        />
      </Sequence>

      {/* Slide 5: Milestones + CTA */}
      <Sequence
        from={TITLE_FRAMES + TIMELINE_FRAMES + COUNTER_FRAMES + BAR_FRAMES}
        durationInFrames={CTA_FRAMES}
        name="CTA"
      >
        <MilestoneCTASlide
          metricType={metricType}
          endValue={endValue}
          days={days}
          milestones={milestones}
        />
      </Sequence>
    </AbsoluteFill>
  )
}
