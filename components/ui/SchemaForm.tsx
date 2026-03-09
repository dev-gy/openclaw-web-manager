import React, { useState } from 'react'
import { Input } from './Input'
import { Select } from './Select'
import { cn } from '../../lib/utils'
import type { ConfigSchema, SchemaProperty, ValidationErrors } from '../../hooks/useConfig'
import { getNestedValue } from '../../hooks/useConfig'

// ─── 타입 ───

interface SchemaFormProps {
  schema: ConfigSchema
  values: Record<string, unknown>
  onChange: (path: string, value: unknown) => void
  className?: string
  pathPrefix?: string
  /** 실시간 유효성 검증 에러 (key: dot-path, value: 에러 메시지) */
  validationErrors?: ValidationErrors
}

// ─── 메인 컴포넌트 ───

/**
 * SchemaForm: JSON Schema 기반 동적 폼 렌더러
 *
 * ConfigSchema를 받아 폼 필드를 자동 생성.
 * 지원 타입: string, number, integer, boolean, object, array(string)
 * 지원 위젯: text, password, textarea, select, number, toggle
 */
export function SchemaForm({ schema, values, onChange, className, pathPrefix = '', validationErrors = {} }: SchemaFormProps) {
  if (!schema.properties) {
    return <p className="text-sm text-text-secondary">스키마에 속성이 없습니다</p>
  }

  // 그룹별 분류
  const groups = groupProperties(schema.properties, pathPrefix)

  return (
    <div className={cn('space-y-6', className)}>
      {groups.map((group) => (
        <FormGroup key={group.name} group={group} values={values} onChange={onChange} validationErrors={validationErrors} />
      ))}
    </div>
  )
}

// ─── 그룹 ───

interface PropertyGroup {
  name: string
  title: string
  fields: { key: string; path: string; prop: SchemaProperty }[]
}

function groupProperties(
  properties: Record<string, SchemaProperty>,
  pathPrefix: string
): PropertyGroup[] {
  const groupMap = new Map<string, PropertyGroup>()

  // x-ui-order로 정렬
  const entries = Object.entries(properties).sort(
    (a, b) => (a[1]['x-ui-order'] ?? 999) - (b[1]['x-ui-order'] ?? 999)
  )

  for (const [key, prop] of entries) {
    const groupName = prop['x-ui-group'] || 'general'
    const path = pathPrefix ? `${pathPrefix}.${key}` : key

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        title: groupTitles[groupName] || key,
        fields: [],
      })
    }

    groupMap.get(groupName)!.fields.push({ key, path, prop })
  }

  return Array.from(groupMap.values())
}

const groupTitles: Record<string, string> = {
  general: '일반',
  gateway: 'Gateway',
  api: 'API',
  channels: '채널',
  models: '모델',
  security: '보안',
  advanced: '고급',
}

function FormGroup({
  group,
  values,
  onChange,
  validationErrors = {},
}: {
  group: PropertyGroup
  values: Record<string, unknown>
  onChange: (path: string, value: unknown) => void
  validationErrors?: ValidationErrors
}) {
  const [collapsed, setCollapsed] = useState(false)

  // 그룹 내 에러 카운트
  const groupErrorCount = group.fields.filter(({ path }) => validationErrors[path]).length

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden',
      groupErrorCount > 0 ? 'border-error/30' : 'border-border',
    )}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-border/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            {group.title}
          </h3>
          {groupErrorCount > 0 && (
            <span className="px-1.5 py-0.5 bg-error/10 text-error text-[10px] font-medium rounded">
              {groupErrorCount}
            </span>
          )}
        </div>
        <span className="text-text-secondary text-xs">
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {group.fields.map(({ key, path, prop }) => (
            <SchemaField
              key={path}
              fieldKey={key}
              path={path}
              prop={prop}
              value={getNestedValue(values, path)}
              onChange={onChange}
              error={validationErrors[path]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 필드 렌더링 ───

function SchemaField({
  fieldKey,
  path,
  prop,
  value,
  onChange,
  error,
}: {
  fieldKey: string
  path: string
  prop: SchemaProperty
  value: unknown
  onChange: (path: string, value: unknown) => void
  error?: string
}) {
  // 객체 타입 → 재귀
  if (prop.type === 'object' && prop.properties) {
    return (
      <div className="pl-4 border-l-2 border-border">
        <label className="block text-sm font-medium text-text-primary mb-2">
          {prop.title || fieldKey}
        </label>
        {prop.description && (
          <p className="text-xs text-text-secondary mb-3">{prop.description}</p>
        )}
        <SchemaForm
          schema={prop as ConfigSchema}
          values={(value as Record<string, unknown>) || {}}
          onChange={onChange}
          pathPrefix={path}
        />
      </div>
    )
  }

  const label = prop.title || fieldKey
  const description = prop.description
  const placeholder = prop['x-ui-placeholder'] || ''
  const widget = prop['x-ui-widget']

  // enum → Select
  if (prop.enum) {
    return (
      <FieldWrapper label={label} description={description} error={error}>
        <Select
          value={String(value ?? prop.default ?? '')}
          onChange={(e) => onChange(path, e.target.value)}
          options={prop.enum.map((v) => ({
            value: v,
            label: prop.enumLabels?.[v] || v,
          }))}
        />
      </FieldWrapper>
    )
  }

  // boolean → toggle
  if (prop.type === 'boolean') {
    return (
      <FieldWrapper label={label} description={description} error={error} inline>
        <button
          onClick={() => onChange(path, !value)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            value ? 'bg-accent' : 'bg-border'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
              value ? 'left-5' : 'left-0.5'
            )}
          />
        </button>
      </FieldWrapper>
    )
  }

  // number / integer
  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <FieldWrapper label={label} description={description} error={error}>
        <Input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(path, v === '' ? undefined : prop.type === 'integer' ? parseInt(v, 10) : parseFloat(v))
          }}
          placeholder={placeholder || String(prop.default ?? '')}
          min={prop.minimum}
          max={prop.maximum}
        />
      </FieldWrapper>
    )
  }

  // string — 위젯에 따라 분기
  if (widget === 'textarea') {
    return (
      <FieldWrapper label={label} description={description} error={error}>
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(path, e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent/30 resize-y"
        />
      </FieldWrapper>
    )
  }

  // string (password / secret)
  if (prop['x-ui-secret'] || prop.format === 'password' || widget === 'password') {
    return (
      <FieldWrapper label={label} description={description} error={error}>
        <Input
          type="password"
          value={String(value ?? '')}
          onChange={(e) => onChange(path, e.target.value)}
          placeholder={placeholder || '••••••••'}
        />
      </FieldWrapper>
    )
  }

  // array of strings
  if (prop.type === 'array' && prop.items?.type === 'string') {
    const items = Array.isArray(value) ? value : []
    return (
      <FieldWrapper label={label} description={description} error={error}>
        <StringArrayField
          values={items as string[]}
          onChange={(newItems) => onChange(path, newItems)}
          placeholder={placeholder}
        />
      </FieldWrapper>
    )
  }

  // default: text input
  return (
    <FieldWrapper label={label} description={description} error={error}>
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(path, e.target.value)}
        placeholder={placeholder || String(prop.default ?? '')}
      />
    </FieldWrapper>
  )
}

// ─── 서브 컴포넌트 ───

function FieldWrapper({
  label,
  description,
  inline,
  error,
  children,
}: {
  label: string
  description?: string
  inline?: boolean
  error?: string
  children: React.ReactNode
}) {
  if (inline) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <span className={cn('text-sm font-medium', error ? 'text-error' : 'text-text-primary')}>
              {label}
            </span>
            {description && (
              <p className="text-xs text-text-secondary mt-0.5">{description}</p>
            )}
          </div>
          {children}
        </div>
        {error && (
          <p className="text-xs text-error mt-1">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <label className={cn('block text-sm font-medium mb-1.5', error ? 'text-error' : 'text-text-primary')}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-error mt-1">{error}</p>
      ) : description ? (
        <p className="text-xs text-text-secondary mt-1">{description}</p>
      ) : null}
    </div>
  )
}

function StringArrayField({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const [newItem, setNewItem] = useState('')

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...values, newItem.trim()])
      setNewItem('')
    }
  }

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {values.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 px-3 py-1.5 bg-bg-secondary rounded-lg text-sm text-text-primary">
            {item}
          </span>
          <button
            onClick={() => handleRemove(i)}
            className="text-xs text-text-secondary hover:text-error transition-colors px-2"
          >
            삭제
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder || '항목 추가...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          className="flex-1"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="px-3 py-1.5 bg-bg-secondary hover:bg-border text-text-primary rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  )
}
