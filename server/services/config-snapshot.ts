/**
 * ConfigSnapshotService
 *
 * 설정 스냅샷 저장/복원/비교 기능.
 * 설정 변경 전 자동으로 스냅샷을 남기고, 문제 시 이전 버전으로 복원.
 *
 * 저장소: SQLite (owm.db의 config_snapshots 테이블)
 */

import { getDb, saveDb } from '../db/index.js'

export interface ConfigSnapshot {
  id: string
  label: string
  config: Record<string, unknown>
  createdAt: string
  type: 'auto' | 'manual'
  hash?: string
}

export interface SnapshotDiff {
  added: string[]
  removed: string[]
  changed: Array<{ path: string; oldValue: unknown; newValue: unknown }>
}

const MAX_AUTO_SNAPSHOTS = 20
const MAX_MANUAL_SNAPSHOTS = 50

/**
 * 스냅샷 테이블 초기화 (마이그레이션)
 */
export async function ensureSnapshotTable(): Promise<void> {
  const db = await getDb()
  db.run(`
    CREATE TABLE IF NOT EXISTS config_snapshots (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      config TEXT NOT NULL,
      hash TEXT,
      type TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
}

/**
 * 스냅샷 목록 조회
 */
export async function listSnapshots(type?: 'auto' | 'manual'): Promise<ConfigSnapshot[]> {
  await ensureSnapshotTable()
  const db = await getDb()

  const query = type
    ? 'SELECT id, label, config, hash, type, created_at FROM config_snapshots WHERE type = ? ORDER BY created_at DESC'
    : 'SELECT id, label, config, hash, type, created_at FROM config_snapshots ORDER BY created_at DESC'

  const rows = db.exec(query, type ? [type] : [])
  if (rows.length === 0) return []

  return rows[0].values.map(([id, label, config, hash, snType, createdAt]: any[]) => ({
    id: String(id),
    label: String(label),
    config: JSON.parse(String(config)),
    hash: hash ? String(hash) : undefined,
    type: (snType as 'auto' | 'manual') || 'manual',
    createdAt: String(createdAt),
  }))
}

/**
 * 스냅샷 1개 조회
 */
export async function getSnapshot(id: string): Promise<ConfigSnapshot | null> {
  await ensureSnapshotTable()
  const db = await getDb()
  const rows = db.exec(
    'SELECT id, label, config, hash, type, created_at FROM config_snapshots WHERE id = ?',
    [id],
  )
  if (rows.length === 0 || rows[0].values.length === 0) return null

  const [sid, label, config, hash, snType, createdAt] = rows[0].values[0]
  return {
    id: String(sid),
    label: String(label),
    config: JSON.parse(String(config)),
    hash: hash ? String(hash) : undefined,
    type: (snType as 'auto' | 'manual') || 'manual',
    createdAt: String(createdAt),
  }
}

/**
 * 스냅샷 생성
 */
export async function createSnapshot(
  config: Record<string, unknown>,
  label: string,
  type: 'auto' | 'manual' = 'manual',
  hash?: string,
): Promise<string> {
  await ensureSnapshotTable()
  const db = await getDb()

  const id = crypto.randomUUID()
  db.run(
    'INSERT INTO config_snapshots (id, label, config, hash, type) VALUES (?, ?, ?, ?, ?)',
    [id, label, JSON.stringify(config), hash || null, type],
  )

  // 자동 스냅샷 개수 제한
  if (type === 'auto') {
    await pruneSnapshots('auto', MAX_AUTO_SNAPSHOTS)
  }

  saveDb()
  return id
}

/**
 * 스냅샷 삭제
 */
export async function deleteSnapshot(id: string): Promise<boolean> {
  await ensureSnapshotTable()
  const db = await getDb()
  db.run('DELETE FROM config_snapshots WHERE id = ?', [id])
  saveDb()
  return true
}

/**
 * 두 설정 비교 (diff)
 */
export function compareConfigs(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): SnapshotDiff {
  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ path: string; oldValue: unknown; newValue: unknown }> = []

  function walk(oldObj: any, newObj: any, prefix: string) {
    const allKeys = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {}),
    ])

    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key
      const oldVal = oldObj?.[key]
      const newVal = newObj?.[key]

      if (oldVal === undefined && newVal !== undefined) {
        added.push(path)
      } else if (oldVal !== undefined && newVal === undefined) {
        removed.push(path)
      } else if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null && !Array.isArray(oldVal) && !Array.isArray(newVal)) {
        walk(oldVal, newVal, path)
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changed.push({ path, oldValue: oldVal, newValue: newVal })
      }
    }
  }

  walk(oldConfig, newConfig, '')
  return { added, removed, changed }
}

/**
 * 오래된 스냅샷 정리
 */
async function pruneSnapshots(type: string, maxCount: number): Promise<void> {
  const db = await getDb()
  db.run(
    `DELETE FROM config_snapshots WHERE id IN (
      SELECT id FROM config_snapshots WHERE type = ?
      ORDER BY created_at DESC
      LIMIT -1 OFFSET ?
    )`,
    [type, maxCount],
  )
}
