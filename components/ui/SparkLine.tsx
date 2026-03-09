import React from 'react'

/**
 * SparkLine: 소형 트렌드 라인 차트
 *
 * 대시보드 카드에 임베드하여 메트릭 추이를 보여주는 미니 차트.
 * SVG 기반, 외부 의존성 없음.
 */

interface SparkLineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  strokeWidth?: number
  className?: string
  /** 최소값 고정 (기본: data 최소) */
  min?: number
  /** 최대값 고정 (기본: data 최대) */
  max?: number
  /** 마지막 점 강조 */
  showDot?: boolean
}

export function SparkLine({
  data,
  width = 120,
  height = 32,
  color = 'var(--color-accent, #7C5CFC)',
  fillOpacity = 0.15,
  strokeWidth = 1.5,
  className = '',
  min: fixedMin,
  max: fixedMax,
  showDot = true,
}: SparkLineProps) {
  if (!data || data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-border, #333)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      </svg>
    )
  }

  const padding = 2
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const minVal = fixedMin ?? Math.min(...data)
  const maxVal = fixedMax ?? Math.max(...data)
  const range = maxVal - minVal || 1

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth
    const y = padding + chartHeight - ((val - minVal) / range) * chartHeight
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`

  const lastPoint = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="트렌드 차트"
    >
      {/* 영역 채우기 */}
      <path d={fillPath} fill={color} opacity={fillOpacity} />

      {/* 선 */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />

      {/* 마지막 점 */}
      {showDot && lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={color} />
      )}
    </svg>
  )
}
