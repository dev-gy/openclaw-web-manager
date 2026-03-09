import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ───

export interface ConfigSchema {
  type: string
  properties?: Record<string, SchemaProperty>
  required?: string[]
  title?: string
  description?: string
}

export interface SchemaProperty {
  type: string
  title?: string
  description?: string
  default?: unknown
  enum?: string[]
  enumLabels?: Record<string, string>
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  properties?: Record<string, SchemaProperty>
  items?: SchemaProperty
  required?: string[]
  // UI 힌트
  'x-ui-widget'?: string
  'x-ui-placeholder'?: string
  'x-ui-group'?: string
  'x-ui-order'?: number
  'x-ui-secret'?: boolean
}

export interface ConfigState {
  schema: ConfigSchema | null
  config: Record<string, unknown> | null
  baseHash: string | null
  loading: boolean
  saving: boolean
  error: string | null
  hasChanges: boolean
}

export interface ConflictInfo {
  /** 서버 측 최신 설정 */
  serverConfig: Record<string, unknown>
  /** 서버 측 최신 해시 */
  serverHash: string
  /** 내 변경사항 (클라이언트 설정) */
  myConfig: Record<string, unknown>
  /** 충돌 세부 메시지 */
  details: string
}

// ─── 훅 ───

/**
 * useConfig: 설정 관리 훅
 *
 * Gateway에서 스키마와 현재 설정을 로드.
 * 변경사항 추적, PATCH로 저장.
 */
export function useConfig() {
  const [schema, setSchema] = useState<ConfigSchema | null>(null)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown> | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)

  // 스키마 + 현재 설정 로드
  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [schemaRes, configRes] = await Promise.all([
        fetch('/api/config/schema'),
        fetch('/api/config/current'),
      ])

      if (schemaRes.ok) {
        const schemaData = await schemaRes.json()
        setSchema(schemaData.schema || schemaData)
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        const currentConfig = configData.config || configData
        setConfig(structuredClone(currentConfig))
        setOriginalConfig(structuredClone(currentConfig))
        setBaseHash(configData.hash || configData.baseHash || null)
      }

      if (!schemaRes.ok && !configRes.ok) {
        setError('Gateway에 연결되어 있지 않습니다')
      }
    } catch (err: any) {
      setError(err.message || '설정 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 설정 값 변경
  const updateField = useCallback((path: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      setNestedValue(next, path, value)
      return next
    })
  }, [])

  // 변경 여부
  const hasChanges = config !== null && originalConfig !== null &&
    JSON.stringify(config) !== JSON.stringify(originalConfig)

  // 저장 (PATCH)
  const save = useCallback(async (): Promise<boolean> => {
    if (!config) return false

    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          baseHash,
        }),
      })

      if (res.status === 409) {
        const conflictData = await res.json().catch(() => ({}))
        if (conflictData.serverConfig) {
          setConflict({
            serverConfig: conflictData.serverConfig,
            serverHash: conflictData.serverHash || '',
            myConfig: structuredClone(config),
            details: conflictData.details || '설정 충돌이 발생했습니다',
          })
        }
        setError('설정 충돌: 다른 곳에서 설정이 변경되었습니다')
        return false
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const result = await res.json()
      setOriginalConfig(structuredClone(config))
      setBaseHash(result.hash || result.baseHash || baseHash)
      return true
    } catch (err: any) {
      setError(err.message || '설정 저장 실패')
      return false
    } finally {
      setSaving(false)
    }
  }, [config, baseHash])

  // 적용
  const apply = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/config/apply', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '적용 실패')
      }
      return true
    } catch (err: any) {
      setError(err.message || '설정 적용 실패')
      return false
    }
  }, [])

  // 리셋
  const reset = useCallback(() => {
    if (originalConfig) {
      setConfig(structuredClone(originalConfig))
    }
    setError(null)
    setConflict(null)
  }, [originalConfig])

  // ─ 충돌 해결 함수들 ─

  /** 서버 버전 수용 (내 변경사항 폐기) */
  const resolveConflictUseServer = useCallback(() => {
    if (!conflict) return
    setConfig(structuredClone(conflict.serverConfig))
    setOriginalConfig(structuredClone(conflict.serverConfig))
    setBaseHash(conflict.serverHash)
    setConflict(null)
    setError(null)
  }, [conflict])

  /** 내 변경사항 강제 저장 (서버 버전 무시) */
  const resolveConflictUseMine = useCallback(async (): Promise<boolean> => {
    if (!conflict) return false
    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/config/force', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: conflict.myConfig }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const result = await res.json()
      setConfig(structuredClone(conflict.myConfig))
      setOriginalConfig(structuredClone(conflict.myConfig))
      setBaseHash(result.hash || result.baseHash || conflict.serverHash)
      setConflict(null)
      return true
    } catch (err: any) {
      setError(err.message || '강제 저장 실패')
      return false
    } finally {
      setSaving(false)
    }
  }, [conflict])

  /** 충돌 무시 (닫기) */
  const dismissConflict = useCallback(() => {
    setConflict(null)
  }, [])

  // ─ 실시간 유효성 검증 ─
  const validationErrors = config && schema
    ? validateConfig(config, schema)
    : {}

  const isValid = Object.keys(validationErrors).length === 0

  return {
    schema,
    config,
    loading,
    saving,
    error,
    hasChanges,
    updateField,
    save,
    apply,
    reset,
    refresh: load,
    validationErrors,
    isValid,
    // 충돌 해결
    conflict,
    resolveConflictUseServer,
    resolveConflictUseMine,
    dismissConflict,
  }
}

// ─── 유틸 ───

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: any = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (current[key] === undefined || current[key] === null) {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: any = obj

  for (const key of keys) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }

  return current
}

// ─── 유효성 검증 ───

export type ValidationErrors = Record<string, string>

/**
 * 설정 값을 스키마에 따라 실시간 검증
 * key: dot-path (예: "server.port"), value: 에러 메시지
 */
function validateConfig(
  config: Record<string, unknown>,
  schema: ConfigSchema,
  prefix = '',
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!schema.properties) return errors

  for (const [key, prop] of Object.entries(schema.properties)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = getNestedValue(config, path)

    // required 검사
    if (schema.required?.includes(key)) {
      if (value === undefined || value === null || value === '') {
        errors[path] = '필수 항목입니다'
        continue
      }
    }

    // undefined/null이면 나머지 검증 스킵 (optional)
    if (value === undefined || value === null) continue

    // 타입별 검증
    switch (prop.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors[path] = '문자열이어야 합니다'
        } else {
          if (prop.minLength !== undefined && value.length < prop.minLength) {
            errors[path] = `최소 ${prop.minLength}자 이상이어야 합니다`
          }
          if (prop.maxLength !== undefined && value.length > prop.maxLength) {
            errors[path] = `최대 ${prop.maxLength}자까지 가능합니다`
          }
          if (prop.pattern) {
            try {
              if (!new RegExp(prop.pattern).test(value)) {
                errors[path] = `형식이 올바르지 않습니다`
              }
            } catch {
              // 잘못된 패턴 무시
            }
          }
          if (prop.enum && !prop.enum.includes(value)) {
            errors[path] = `허용된 값: ${prop.enum.join(', ')}`
          }
          // format 검증
          if (prop.format === 'uri' || prop.format === 'url') {
            try {
              new URL(value)
            } catch {
              errors[path] = '올바른 URL 형식이 아닙니다'
            }
          }
          if (prop.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors[path] = '올바른 이메일 형식이 아닙니다'
          }
        }
        break

      case 'number':
      case 'integer':
        const num = typeof value === 'string' ? Number(value) : value
        if (typeof num !== 'number' || isNaN(num as number)) {
          errors[path] = '숫자여야 합니다'
        } else {
          if (prop.minimum !== undefined && (num as number) < prop.minimum) {
            errors[path] = `최소값: ${prop.minimum}`
          }
          if (prop.maximum !== undefined && (num as number) > prop.maximum) {
            errors[path] = `최대값: ${prop.maximum}`
          }
          if (prop.type === 'integer' && !Number.isInteger(num)) {
            errors[path] = '정수여야 합니다'
          }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors[path] = 'true 또는 false여야 합니다'
        }
        break

      case 'object':
        if (typeof value === 'object' && value !== null && prop.properties) {
          const subSchema: ConfigSchema = {
            type: 'object',
            properties: prop.properties,
            required: prop.required,
          }
          const subErrors = validateConfig(config, subSchema, path)
          Object.assign(errors, subErrors)
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          errors[path] = '배열이어야 합니다'
        }
        break
    }
  }

  return errors
}
