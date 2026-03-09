import initSqlJs, { type Database } from 'sql.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.OWM_DB_PATH || path.join(__dirname, '..', '..', 'data', 'owm.db')

const SESSION_TTL_HOURS = 24

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (!db) {
    const SQL = await initSqlJs()

    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH)
      db = new SQL.Database(buffer)
    } else {
      db = new SQL.Database()
    }

    initSchema(db)
  }
  return db
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      ssh_port INTEGER DEFAULT 22,
      ssh_username TEXT NOT NULL,
      ssh_credential BLOB,
      ssh_auth_type TEXT DEFAULT 'password',
      gateway_port INTEGER DEFAULT 18789,
      gateway_token BLOB,
      status TEXT DEFAULT 'disconnected',
      openclaw_version TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Migrations
  try { db.run('ALTER TABLE servers ADD COLUMN deploy_type TEXT DEFAULT "ssh"') } catch {}
  try { db.run('ALTER TABLE servers ADD COLUMN process_type TEXT DEFAULT "direct"') } catch {}
  try { db.run('ALTER TABLE servers ADD COLUMN config_path TEXT') } catch {}
}

// --- User helpers ---

export async function ensureDefaultAdmin(): Promise<void> {
  const d = await getDb()
  const row = d.exec("SELECT id FROM users WHERE username = 'admin'")
  if (row.length === 0) {
    const defaultPass = process.env.OWM_ADMIN_PASS || 'admin'
    const hash = await bcrypt.hash(defaultPass, 10)
    d.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash])
    saveDb()
    console.log('[db] Default admin account created')
  }
}

export async function verifyUser(
  username: string,
  password: string,
): Promise<{ id: number; username: string } | null> {
  const d = await getDb()
  const rows = d.exec('SELECT id, username, password_hash FROM users WHERE username = ?', [username])
  if (rows.length === 0 || rows[0].values.length === 0) return null

  const [id, uname, hash] = rows[0].values[0] as [number, string, string]
  const valid = await bcrypt.compare(password, hash)
  if (!valid) return null

  return { id, username: uname }
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
  const d = await getDb()
  const rows = d.exec('SELECT password_hash FROM users WHERE id = ?', [userId])
  if (rows.length === 0 || rows[0].values.length === 0) return false

  const [hash] = rows[0].values[0] as [string]
  const valid = await bcrypt.compare(oldPassword, hash)
  if (!valid) return false

  const newHash = await bcrypt.hash(newPassword, 10)
  d.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
  saveDb()
  return true
}

// --- Session helpers ---

export async function createSession(userId: number): Promise<string> {
  const d = await getDb()
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString()
  d.run('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)', [id, userId, token, expiresAt])
  saveDb()
  return token
}

export async function validateSession(
  token: string,
): Promise<{ userId: number; username: string } | null> {
  const d = await getDb()
  const rows = d.exec(
    `SELECT s.user_id, u.username, s.expires_at
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ?`,
    [token],
  )
  if (rows.length === 0 || rows[0].values.length === 0) return null

  const [userId, username, expiresAt] = rows[0].values[0] as [number, string, string]
  if (new Date(expiresAt) < new Date()) {
    d.run('DELETE FROM sessions WHERE token = ?', [token])
    saveDb()
    return null
  }

  return { userId, username }
}

export async function deleteSession(token: string): Promise<void> {
  const d = await getDb()
  d.run('DELETE FROM sessions WHERE token = ?', [token])
  saveDb()
}

export async function cleanExpiredSessions(): Promise<number> {
  const d = await getDb()
  const before = d.exec('SELECT COUNT(*) FROM sessions WHERE expires_at < datetime("now")')
  const count = before.length > 0 ? (before[0].values[0][0] as number) : 0
  d.run('DELETE FROM sessions WHERE expires_at < datetime("now")')
  if (count > 0) saveDb()
  return count
}

// --- Server helpers ---

export interface ServerRecord {
  id?: string
  name: string
  host: string
  deployType?: 'ssh' | 'docker' | 'local'
  processType?: 'systemd' | 'direct'
  configPath?: string
  sshPort?: number
  sshUsername?: string
  sshAuthType?: 'password' | 'key'
  gatewayPort?: number
  gatewayToken?: string
  openclawVersion?: string
}

export async function saveServer(server: ServerRecord): Promise<string> {
  const d = await getDb()
  const id = server.id || crypto.randomUUID()
  d.run(
    `INSERT OR REPLACE INTO servers (id, name, host, deploy_type, process_type, config_path, ssh_port, ssh_username, ssh_auth_type, gateway_port, gateway_token, openclaw_version, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', datetime('now'))`,
    [
      id,
      server.name,
      server.host,
      server.deployType || 'local',
      server.processType || 'direct',
      server.configPath || null,
      server.sshPort || 22,
      server.sshUsername || '',
      server.sshAuthType || 'password',
      server.gatewayPort || 18789,
      server.gatewayToken || null,
      server.openclawVersion || null,
    ],
  )
  saveDb()
  return id
}

// --- Persistence ---

export function saveDb() {
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }
}

export function closeDb() {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}
