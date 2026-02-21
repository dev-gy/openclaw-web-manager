import { useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'

interface RpcResponse {
  id: string
  result?: any
  error?: string
}

/**
 * Hook for making Gateway RPC calls via the /ws/gateway proxy.
 */
export function useGatewayRpc() {
  const rpcIdRef = useRef(0)
  const pendingRef = useRef(
    new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  )

  const handleMessage = useCallback((data: RpcResponse) => {
    if (data.id && pendingRef.current.has(data.id)) {
      const pending = pendingRef.current.get(data.id)!
      pendingRef.current.delete(data.id)
      if (data.error) {
        pending.reject(new Error(data.error))
      } else {
        pending.resolve(data.result)
      }
    }
  }, [])

  const { connected, send, error } = useWebSocket({
    url: '/ws/gateway',
    onMessage: handleMessage,
    autoConnect: false,
  })

  const rpc = useCallback(
    (method: string, params?: unknown): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = `rpc-${++rpcIdRef.current}`
        const timeout = setTimeout(() => {
          pendingRef.current.delete(id)
          reject(new Error(`RPC timeout: ${method}`))
        }, 30000)

        pendingRef.current.set(id, {
          resolve: (v) => {
            clearTimeout(timeout)
            resolve(v)
          },
          reject: (e) => {
            clearTimeout(timeout)
            reject(e)
          },
        })

        send({ id, method, params })
      })
    },
    [send]
  )

  return { rpc, connected, error }
}
