import React, { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'

/**
 * DataTable: 범용 데이터 테이블
 *
 * 정렬, 검색, 빈 상태, 행 클릭 지원.
 * 모니터링 페이지(세션, 로그 등)에서 재사용.
 */

export interface Column<T> {
  key: string
  header: string
  /** 셀 렌더링 */
  render?: (row: T, index: number) => React.ReactNode
  /** 정렬 가능 여부 */
  sortable?: boolean
  /** 정렬 비교 함수 */
  sortFn?: (a: T, b: T) => number
  /** 열 너비 (CSS) */
  width?: string
  /** 헤더/셀 정렬 */
  align?: 'left' | 'center' | 'right'
  /** 모바일에서 숨김 */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  /** 행 고유 키 추출 */
  rowKey: (row: T, index: number) => string
  /** 행 클릭 */
  onRowClick?: (row: T) => void
  /** 선택된 행 키 */
  selectedKey?: string | null
  /** 빈 상태 텍스트 */
  emptyText?: string
  /** 빈 상태 설명 */
  emptyDescription?: string
  /** 로딩 상태 */
  loading?: boolean
  /** 검색 필터 */
  searchValue?: string
  /** 검색 필터 함수 */
  searchFilter?: (row: T, query: string) => boolean
  /** 상단 좌측 슬롯 (제목 등) */
  headerLeft?: React.ReactNode
  /** 상단 우측 슬롯 (버튼 등) */
  headerRight?: React.ReactNode
  /** 최대 높이 (스크롤) */
  maxHeight?: string
  /** 컴팩트 행 간격 */
  compact?: boolean
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectedKey,
  emptyText = '데이터가 없습니다',
  emptyDescription,
  loading = false,
  searchValue,
  searchFilter,
  headerLeft,
  headerRight,
  maxHeight,
  compact = false,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // 검색 필터링
  const filtered = useMemo(() => {
    if (!searchValue || !searchFilter) return data
    const q = searchValue.toLowerCase()
    return data.filter((row) => searchFilter(row, q))
  }, [data, searchValue, searchFilter])

  // 정렬
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortFn) return filtered

    return [...filtered].sort((a, b) => {
      const result = col.sortFn!(a, b)
      return sortDir === 'desc' ? -result : result
    })
  }, [filtered, sortKey, sortDir, columns])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const rowPadding = compact ? 'py-2 px-3' : 'py-3 px-4'

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      {/* 상단 헤더 */}
      {(headerLeft || headerRight) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>{headerLeft}</div>
          <div>{headerRight}</div>
        </div>
      )}

      {/* 테이블 래퍼 */}
      <div className={cn('overflow-x-auto', maxHeight && 'overflow-y-auto')} style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full text-sm" role="table">
          {/* 헤더 */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-secondary border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider text-left',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:text-text-primary select-none',
                    col.hideOnMobile && 'hidden md:table-cell',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-accent text-[10px]">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디 */}
          <tbody className="divide-y divide-border">
            {loading && sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-text-secondary">
                  데이터를 불러오는 중...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <p className="text-text-secondary">{emptyText}</p>
                  {emptyDescription && (
                    <p className="text-text-secondary text-xs mt-1">{emptyDescription}</p>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
                const key = rowKey(row, i)
                const isSelected = selectedKey === key
                return (
                  <tr
                    key={key}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected ? 'bg-accent/5' : onRowClick && 'hover:bg-bg-secondary',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          rowPadding,
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right',
                          col.hideOnMobile && 'hidden md:table-cell',
                        )}
                      >
                        {col.render
                          ? col.render(row, i)
                          : String((row as any)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 정보 */}
      {sorted.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs text-text-secondary">
          {searchValue && filtered.length !== data.length
            ? `${data.length}개 중 ${filtered.length}개 표시`
            : `총 ${sorted.length}개`}
        </div>
      )}
    </div>
  )
}
