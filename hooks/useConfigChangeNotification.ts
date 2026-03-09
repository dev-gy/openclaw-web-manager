import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

/**
 * useConfigChangeNotification: 외부 설정 변경 감지 알림
 *
 * Gateway에서 OWM 외부(CLI, 직접 파일 수정 등)로 설정이 변경되면
 * 실시간으로 알림을 받아 UI에 표시합니다.
 *
 * 사용법:
 *   const { hasExternalChange, changedKeys, dismiss, reload } = useConfigChangeNotification()
 */

export interface ConfigChangeEvent {
  type: 'config-changed'
  previousHash: string
  currentHash: string
  changedKeys: string[]
  timestamp: number
}

interface UseConfigChangeNotificationReturn {
  /** 외부 변경이 감지되었는가 */
  hasExternalChange: boolean
  /** 변경된 설정 키 목록 */
  changedKeys: string[]
  /** 변경 시각 */
  changedAt: number | null
  /** 알림 무시 (닫기) */
  dismiss: () => void
  /** 설정 새로고침 (페이지 리로드 없이 config 재로드) */
  reload: () => void
}

export function useConfigChangeNotification(): UseConfigChangeNotificationReturn {
  const [changeEvent, setChangeEvent] = useState<ConfigChangeEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const { connected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (data) => {
      if (data.channel === 'config-change' && data.type === 'config-changed') {
        setChangeEvent(data as ConfigChangeEvent)
        setDismissed(false)
      }
    },
    autoConnect: true,
  })

  // 구독
  useEffect(() => {
    if (connected) {
      send({ type: 'subscribe', channel: 'config-change' })
    }
  }, [connected, send])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const reload = useCallback(() => {
    // 이벤트 초기화하고 config 훅 들이 refetch하도록 이벤트 emit
    setChangeEvent(null)
    setDismissed(false)
    // 페이지 전체 리로드가 가장 확실한 방법
    window.location.reload()
  }, [])

  return {
    hasExternalChange: !dismissed && changeEvent !== null,
    changedKeys: changeEvent?.changedKeys || [],
    changedAt: changeEvent?.timestamp || null,
    dismiss,
    reload,
  }
}
