/**
 * ShortFormVideo.tsx — Remotion composition for short-form content videos
 * Optimized for TikTok / YouTube Shorts / Instagram Reels (1080x1920)
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
export interface Slide {
  type: 'hook' | 'problem' | 'solution' | 'proof' | 'cta'
  startFrame: number
  durationInFrames: number
  content: string | string[]
  backgroundColor?: string
  textColor?: string
}

export interface ShortFormVideoProps {
  durationInFrames: number
  fps: number
  width: number
  height: number
  slides: Slide[]
}

// ─── Hook Slide: Bold zoom-in with color highlight ────────────────────────────
function HookSlide({ content, textColor = '#A78BFA' }: { content: string; textColor?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
    from: 0.7,
    to: 1,
  })

  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      {/* Gradient backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${textColor}22 0%, transparent 70%)`,
        }}
      />

      {/* Emoji attention grabber */}
      <div
        style={{
          fontSize: 96,
          marginBottom: 30,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        ⚡
      </div>

      {/* Main hook text */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          color: textColor,
          textAlign: 'center',
          lineHeight: 1.15,
          transform: `scale(${scale})`,
          opacity,
          textShadow: `0 0 40px ${textColor}66`,
          letterSpacing: '-1px',
        }}
      >
        {content}
      </div>

      {/* Bottom pulse indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: 6,
          height: 60,
          backgroundColor: textColor,
          borderRadius: 3,
          opacity: interpolate(frame % 15, [0, 7, 14], [0.3, 1, 0.3]),
        }}
      />
    </AbsoluteFill>
  )
}

// ─── Problem Slide: Text fade-in with emoji ───────────────────────────────────
function ProblemSlide({ content, textColor = '#F87171' }: { content: string; textColor?: string }) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const translateY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${textColor}, transparent)`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      />

      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
        }}
      >
        {/* Pain emoji */}
        <div style={{ fontSize: 100, marginBottom: 40 }}>😤</div>

        {/* Problem label */}
        <div
          style={{
            fontSize: 28,
            color: textColor,
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: 24,
            opacity: 0.8,
          }}
        >
          공감하시나요?
        </div>

        {/* Problem text */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {content}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Solution Slide: Step-by-step reveal ─────────────────────────────────────
function SolutionSlide({ content, textColor = '#34D399' }: { content: string[]; textColor?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const steps = Array.isArray(content) ? content : [content]
  // Each step appears every ~5 seconds (150 frames at 30fps)
  const framesPerStep = 150

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0F',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px 60px',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 36,
          color: textColor,
          fontWeight: 700,
          letterSpacing: '4px',
          marginBottom: 60,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        ✅ 해결책
      </div>

      {/* Steps */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {steps.map((step, index) => {
          const stepStartFrame = index * framesPerStep
          const stepOpacity = interpolate(
            frame,
            [stepStartFrame, stepStartFrame + 20],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )
          const stepX = interpolate(
            frame,
            [stepStartFrame, stepStartFrame + 20],
            [-60, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )

          const scale = spring({
            frame: frame - stepStartFrame,
            fps,
            config: { damping: 15, stiffness: 150 },
            from: 0.8,
            to: 1,
          })

          return (
            <div
              key={index}
              style={{
                opacity: stepOpacity,
                transform: `translateX(${stepX}px) scale(${scale})`,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  backgroundColor: textColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#0A0A0F',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>
              {/* Step text */}
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                }}
              >
                {step}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ─── Proof Slide: Number counter + visual bar ─────────────────────────────────
function ProofSlide({ content, textColor = '#60A5FA' }: { content: string; textColor?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  // Bar chart grows from 0 to full width
  const barWidth = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
    from: 0,
    to: 100,
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
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at bottom, ${textColor}15 0%, transparent 60%)`,
        }}
      />

      <div style={{ opacity, textAlign: 'center', width: '100%' }}>
        {/* Label */}
        <div
          style={{
            fontSize: 28,
            color: textColor,
            fontWeight: 700,
            letterSpacing: '4px',
            marginBottom: 30,
          }}
        >
          📊 실제 결과
        </div>

        {/* Proof text */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.3,
            marginBottom: 60,
          }}
        >
          {content}
        </div>

        {/* Animated bar chart */}
        <div
          style={{
            backgroundColor: '#1A1A2E',
            borderRadius: 12,
            height: 32,
            width: '100%',
            overflow: 'hidden',
            border: `2px solid ${textColor}33`,
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${textColor}88, ${textColor})`,
              borderRadius: 10,
              transition: 'none',
            }}
          />
        </div>

        {/* Percentage label */}
        <div
          style={{
            fontSize: 28,
            color: textColor,
            marginTop: 16,
            fontWeight: 600,
          }}
        >
          {Math.round(barWidth)}% 달성
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── CTA Slide: Brand colors + follow button pulse ────────────────────────────
function CTASlide({ content }: { content: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.8 },
    from: 0.5,
    to: 1,
  })

  // Pulsing button
  const buttonScale = interpolate(
    frame % 30,
    [0, 15, 30],
    [1, 1.05, 1]
  )

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #DB2777 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 50px',
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          top: -100,
          right: -200,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          bottom: -50,
          left: -100,
        }}
      />

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        {/* OOMNI brand */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '6px',
            marginBottom: 30,
          }}
        >
          OOMNI
        </div>

        {/* CTA text */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: 50,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {content}
        </div>

        {/* Follow button */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            color: '#4F46E5',
            fontSize: 40,
            fontWeight: 900,
            padding: '24px 60px',
            borderRadius: 100,
            display: 'inline-block',
            transform: `scale(${buttonScale})`,
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          }}
        >
          팔로우 👆
        </div>

        {/* Decorative hearts */}
        <div style={{ marginTop: 40, fontSize: 40 }}>
          {['❤️', '🔥', '⭐'].map((emoji, i) => (
            <span
              key={i}
              style={{
                marginRight: 16,
                opacity: interpolate(
                  frame,
                  [i * 10, i * 10 + 15],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                ),
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Main ShortFormVideo Composition ─────────────────────────────────────────
export function ShortFormVideo({ slides }: ShortFormVideoProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0F' }}>
      {slides.map((slide, index) => (
        <Sequence
          key={index}
          from={slide.startFrame}
          durationInFrames={slide.durationInFrames}
          name={slide.type}
        >
          {slide.type === 'hook' && (
            <HookSlide
              content={typeof slide.content === 'string' ? slide.content : slide.content[0]}
              textColor={slide.textColor}
            />
          )}
          {slide.type === 'problem' && (
            <ProblemSlide
              content={typeof slide.content === 'string' ? slide.content : slide.content[0]}
              textColor={slide.textColor}
            />
          )}
          {slide.type === 'solution' && (
            <SolutionSlide
              content={Array.isArray(slide.content) ? slide.content : [slide.content]}
              textColor={slide.textColor}
            />
          )}
          {slide.type === 'proof' && (
            <ProofSlide
              content={typeof slide.content === 'string' ? slide.content : slide.content[0]}
              textColor={slide.textColor}
            />
          )}
          {slide.type === 'cta' && (
            <CTASlide
              content={typeof slide.content === 'string' ? slide.content : slide.content[0]}
            />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
