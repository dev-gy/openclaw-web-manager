import React from 'react'
import type { AgentState } from '../../hooks/useAgentActivity'
import { cn, seedToColors } from '../../lib/utils'

/**
 * AgentAvatar: 결정론적 SVG 아바타 + 상태 애니메이션
 *
 * - avatarSeed로 결정론적 색상 생성
 * - 상태별 CSS 애니메이션 (idle 흔들, working 점멸, speaking 펄스, error 빨갛게)
 * - 레트로 픽셀 스타일
 */

interface AgentAvatarProps {
  seed: number
  state: AgentState
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
}

/** 상태별 클래스 */
function stateClass(state: AgentState): string {
  switch (state) {
    case 'working':
      return 'animate-agent-working'
    case 'speaking':
      return 'animate-agent-speaking'
    case 'tool_calling':
      return 'animate-agent-tool'
    case 'idle':
      return 'animate-agent-idle'
    case 'error':
      return 'animate-agent-error'
    case 'offline':
      return 'opacity-40 grayscale'
    default:
      return ''
  }
}

/** 상태별 인디케이터 색상 */
function stateIndicatorColor(state: AgentState): string {
  switch (state) {
    case 'working':
      return '#22c55e' // green
    case 'speaking':
      return '#3b82f6' // blue
    case 'tool_calling':
      return '#f59e0b' // amber
    case 'idle':
      return '#6b7280' // gray
    case 'error':
      return '#ef4444' // red
    case 'offline':
      return '#374151' // dark gray
    default:
      return '#6b7280'
  }
}

export function AgentAvatar({
  seed,
  state,
  name,
  size = 'md',
  className,
}: AgentAvatarProps) {
  const px = sizeMap[size]
  const colors = seedToColors(seed)
  const indicatorR = size === 'sm' ? 3 : size === 'md' ? 4 : 5

  // 8×8 그리드 기반 간단한 캐릭터 (레트로 스타일)
  // 좌우 대칭으로 생성
  const eyeY = px * 0.34
  const eyeSpacing = px * 0.14
  const mouthY = px * 0.52
  const bodyTop = px * 0.62
  const headR = px * 0.22

  return (
    <div
      className={cn('relative inline-block', stateClass(state), className)}
      title={`${name} (${state})`}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        className="overflow-visible"
        aria-label={`${name} 아바타`}
      >
        {/* 그림자 */}
        <ellipse
          cx={px / 2}
          cy={px * 0.92}
          rx={px * 0.28}
          ry={px * 0.06}
          fill="rgba(0,0,0,0.15)"
        />

        {/* 몸통 */}
        <rect
          x={px * 0.28}
          y={bodyTop}
          width={px * 0.44}
          height={px * 0.3}
          rx={px * 0.06}
          fill={colors.body}
        />

        {/* 다리 */}
        <rect
          x={px * 0.32}
          y={px * 0.85}
          width={px * 0.12}
          height={px * 0.1}
          rx={px * 0.03}
          fill={colors.accent}
        />
        <rect
          x={px * 0.56}
          y={px * 0.85}
          width={px * 0.12}
          height={px * 0.1}
          rx={px * 0.03}
          fill={colors.accent}
        />

        {/* 머리 */}
        <circle
          cx={px / 2}
          cy={px * 0.3}
          r={headR}
          fill={colors.detail}
        />

        {/* 얼굴 배경 */}
        <circle
          cx={px / 2}
          cy={px * 0.32}
          r={headR * 0.82}
          fill="#fce4c8"
        />

        {/* 눈 */}
        {state === 'idle' ? (
          // 졸린 눈 (일자)
          <>
            <line
              x1={px / 2 - eyeSpacing - 2}
              y1={eyeY}
              x2={px / 2 - eyeSpacing + 2}
              y2={eyeY}
              stroke="#1f2937"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <line
              x1={px / 2 + eyeSpacing - 2}
              y1={eyeY}
              x2={px / 2 + eyeSpacing + 2}
              y2={eyeY}
              stroke="#1f2937"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </>
        ) : state === 'error' ? (
          // 엑스 눈
          <>
            <g transform={`translate(${px / 2 - eyeSpacing}, ${eyeY})`}>
              <line x1={-2} y1={-2} x2={2} y2={2} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={2} y1={-2} x2={-2} y2={2} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
            </g>
            <g transform={`translate(${px / 2 + eyeSpacing}, ${eyeY})`}>
              <line x1={-2} y1={-2} x2={2} y2={2} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={2} y1={-2} x2={-2} y2={2} stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" />
            </g>
          </>
        ) : (
          // 정상 눈
          <>
            <circle cx={px / 2 - eyeSpacing} cy={eyeY} r={1.8} fill="#1f2937" />
            <circle cx={px / 2 + eyeSpacing} cy={eyeY} r={1.8} fill="#1f2937" />
          </>
        )}

        {/* 입 */}
        {state === 'speaking' ? (
          // 말하는 입 (원)
          <ellipse cx={px / 2} cy={mouthY} rx={2.5} ry={2} fill="#1f2937" />
        ) : state === 'error' ? (
          // 찡그린 입
          <path
            d={`M${px / 2 - 3} ${mouthY + 1} Q${px / 2} ${mouthY - 2} ${px / 2 + 3} ${mouthY + 1}`}
            stroke="#1f2937"
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          // 기본 미소
          <path
            d={`M${px / 2 - 3} ${mouthY} Q${px / 2} ${mouthY + 3} ${px / 2 + 3} ${mouthY}`}
            stroke="#1f2937"
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* 팔 */}
        {state === 'working' || state === 'tool_calling' ? (
          // 움직이는 팔
          <>
            <rect
              x={px * 0.18}
              y={bodyTop + px * 0.02}
              width={px * 0.1}
              height={px * 0.18}
              rx={px * 0.03}
              fill={colors.body}
              className="origin-top animate-agent-arm"
            />
            <rect
              x={px * 0.72}
              y={bodyTop + px * 0.02}
              width={px * 0.1}
              height={px * 0.18}
              rx={px * 0.03}
              fill={colors.body}
            />
          </>
        ) : (
          // 기본 팔
          <>
            <rect
              x={px * 0.18}
              y={bodyTop + px * 0.04}
              width={px * 0.1}
              height={px * 0.16}
              rx={px * 0.03}
              fill={colors.body}
            />
            <rect
              x={px * 0.72}
              y={bodyTop + px * 0.04}
              width={px * 0.1}
              height={px * 0.16}
              rx={px * 0.03}
              fill={colors.body}
            />
          </>
        )}

        {/* 모자/헤어 (seed 기반 랜덤) */}
        {seed % 3 === 0 && (
          <rect
            x={px * 0.24}
            y={px * 0.12}
            width={px * 0.52}
            height={px * 0.08}
            rx={2}
            fill={colors.accent}
          />
        )}
        {seed % 3 === 1 && (
          <path
            d={`M${px * 0.28} ${px * 0.2} Q${px / 2} ${px * 0.05} ${px * 0.72} ${px * 0.2}`}
            stroke={colors.accent}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* tool_calling: 도구 아이콘 (렌치) */}
        {state === 'tool_calling' && (
          <g transform={`translate(${px * 0.78}, ${bodyTop - 2}) scale(0.5)`}>
            <circle cx={4} cy={4} r={5} fill="#f59e0b" opacity={0.9} />
            <text x={4} y={7} textAnchor="middle" fontSize={8} fill="white">🔧</text>
          </g>
        )}
      </svg>

      {/* 상태 인디케이터 (점) */}
      <span
        className={cn(
          'absolute block rounded-full border-2 border-card',
          state === 'working' && 'animate-pulse',
          state === 'speaking' && 'animate-pulse',
        )}
        style={{
          width: indicatorR * 2,
          height: indicatorR * 2,
          backgroundColor: stateIndicatorColor(state),
          bottom: 0,
          right: 0,
        }}
      />
    </div>
  )
}
