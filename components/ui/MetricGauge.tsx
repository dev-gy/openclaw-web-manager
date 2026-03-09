import React from 'react'

/**
 * MetricGauge: 반원형 게이지
 *
 * CPU, 메모리, 디스크 사용률 등을 시각적으로 표시.
 * SVG 기반, 0-100% 범위.
 */

interface MetricGaugeProps {
  value: number          // 0~100
  label: string
  unit?: string          // 단위 (예: '%', 'MB')
  size?: number          // 전체 크기 (px)
  thickness?: number     // 호 두께
  color?: string         // 게이지 색상
  warningThreshold?: number  // 이 값 이상이면 warning 색상
  dangerThreshold?: number   // 이 값 이상이면 danger 색상
  className?: string
}

export function MetricGauge({
  value,
  label,
  unit = '%',
  size = 100,
  thickness = 8,
  color,
  warningThreshold = 70,
  dangerThreshold = 90,
  className = '',
}: MetricGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value))

  // 색상 결정
  const gaugeColor = color || (
    clampedValue >= dangerThreshold
      ? 'var(--color-error, #EF4444)'
      : clampedValue >= warningThreshold
        ? 'var(--color-warning, #F59E0B)'
        : 'var(--color-accent, #7C5CFC)'
  )

  const center = size / 2
  const radius = center - thickness / 2 - 2

  // 반원 (180°) 아크
  const startAngle = Math.PI   // 왼쪽 (180°)
  const endAngle = 0           // 오른쪽 (0°)
  const sweepAngle = Math.PI   // 총 180°

  // 배경 호
  const bgStartX = center + radius * Math.cos(startAngle)
  const bgStartY = center + radius * Math.sin(startAngle)
  const bgEndX = center + radius * Math.cos(endAngle)
  const bgEndY = center + radius * Math.sin(endAngle)
  const bgPath = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}`

  // 값 호
  const valueAngle = startAngle - (clampedValue / 100) * sweepAngle
  const valueEndX = center + radius * Math.cos(valueAngle)
  const valueEndY = center + radius * Math.sin(valueAngle)
  const largeArcFlag = clampedValue > 50 ? 1 : 0
  const valuePath = clampedValue > 0
    ? `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${valueEndX} ${valueEndY}`
    : ''

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size * 0.6}
        viewBox={`0 0 ${size} ${size * 0.6}`}
        role="meter"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${clampedValue}${unit}`}
      >
        {/* 배경 호 */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--color-border, #333)"
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* 값 호 */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        )}

        {/* 값 텍스트 */}
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          dominantBaseline="alphabetic"
          className="text-text-primary"
          style={{ fontSize: size * 0.22, fontWeight: 700, fill: 'currentColor' }}
        >
          {Math.round(clampedValue)}{unit}
        </text>
      </svg>

      {/* 라벨 */}
      <span className="text-xs text-text-secondary mt-1">{label}</span>
    </div>
  )
}
