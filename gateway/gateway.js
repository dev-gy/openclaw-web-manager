/**
 * OpenClaw Gateway — WebSocket RPC Server (Real LLM Integration)
 *
 * OWM(Web Manager)이 연결하여 에이전트를 관리하는 실제 Gateway 서버.
 * WebSocket JSON-RPC 프로토콜:
 *   요청: { id, method, params? }
 *   응답: { id, result } 또는 { id, error }
 *   이벤트(push): { type, ... }
 *
 * LLM 연동:
 *   - Anthropic (Claude): claude-* 모델 → Messages API
 *   - OpenAI (GPT): gpt-*, o1-*, o3-* 모델 → Chat Completions API
 *   - OpenAI-compatible: 기타 모델 → 커스텀 baseUrl
 */

import { WebSocketServer, WebSocket } from 'ws'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

// ─── 상태 저장소 ───

const state = {
  startedAt: Date.now(),
  config: {
    gateway: { port: 18789, token: '' },
    server: { name: 'OpenClaw Gateway', logLevel: 'info', hotReload: true },
    llm: {
      provider: 'auto',   // 'auto' | 'openai' | 'anthropic'
      apiKey: '',          // LLM API 키
      baseUrl: '',         // OpenAI-compatible 커스텀 URL (Ollama 등)
    },
    channels: {
      discord: { enabled: false, token: '', prefix: '!' },
      slack: { enabled: false, botToken: '', appToken: '' },
      telegram: { enabled: false, botToken: '' },
    },
    agents: [
      {
        id: 'agent-alpha',
        name: 'Alpha',
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        systemPrompt: '당신은 친절한 AI 어시스턴트입니다. 사용자의 질문에 정확하고 도움이 되는 답변을 제공합니다.',
        tools: ['web_search', 'calculator', 'code_interpreter'],
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: 'agent-beta',
        name: 'Beta',
        model: 'gpt-4o',
        role: 'coder',
        systemPrompt: '당신은 코드 전문가입니다. 간결하고 효율적인 코드를 작성하며, 코드 리뷰와 디버깅을 도와줍니다.',
        tools: ['code_interpreter', 'file_manager'],
        maxTokens: 8192,
        temperature: 0.3,
      },
      {
        id: 'agent-gamma',
        name: 'Gamma',
        model: 'claude-sonnet-4-20250514',
        role: 'researcher',
        systemPrompt: '당신은 리서치 전문가입니다. 정확한 정보와 함께 체계적인 분석을 제공합니다.',
        tools: ['web_search', 'arxiv_search'],
        maxTokens: 4096,
        temperature: 0.5,
      },
    ],
    security: {
      apiToken: '',
      tokenRotationDays: 90,
      allowAnonymous: false,
      cors: { enabled: true, origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] },
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      ipWhitelist: { enabled: false, addresses: [] },
    },
    prompts: [
      { id: 'p1', name: '기본 어시스턴트', content: '당신은 친절한 AI 어시스턴트입니다.', category: 'general' },
      { id: 'p2', name: '코드 전문가', content: '당신은 코드 전문가입니다. 간결하고 효율적인 코드를 작성합니다.', category: 'coding' },
      { id: 'p3', name: '리서치 전문가', content: '당신은 리서치 전문가입니다. 정확한 출처와 함께 답변합니다.', category: 'research' },
    ],
  },
  configHash: null,
  sessions: [],
  logs: [],
  agentStates: {},
  demoMode: false, // API 키 없으면 true
}

// config hash 계산
function computeConfigHash() {
  state.configHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(state.config))
    .digest('hex')
    .slice(0, 12)
}
computeConfigHash()

// ─── LLM API 키 확인 ───

function getLLMApiKey() {
  // 우선순위: config.llm.apiKey > config.security.apiToken > env
  return (
    state.config.llm.apiKey ||
    state.config.security.apiToken ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  )
}

function hasLLMApiKey() {
  return !!getLLMApiKey()
}

function updateDemoMode() {
  const wasDemoMode = state.demoMode
  state.demoMode = !hasLLMApiKey()
  if (wasDemoMode !== state.demoMode) {
    if (state.demoMode) {
      addLog('warn', 'API 키 미설정 — 데모 모드 (시뮬레이션 활성)')
    } else {
      addLog('info', 'API 키 감지됨 — 실제 LLM 모드 활성')
    }
  }
}

// ─── LLM 클라이언트 ───

function detectProvider(model) {
  const explicit = state.config.llm.provider
  if (explicit && explicit !== 'auto') return explicit

  if (/^claude-/.test(model)) return 'anthropic'
  if (/^(gpt-|o1|o3|chatgpt-)/.test(model)) return 'openai'
  return 'openai' // 기본: OpenAI-compatible
}

/**
 * LLM API 호출 — 실제 AI 응답 생성
 * @param {object} agent - 에이전트 설정 (model, systemPrompt, maxTokens, temperature)
 * @param {Array} messages - 대화 히스토리 [{ role, content }]
 * @returns {Promise<string>} AI 응답 텍스트
 */
async function callLLM(agent, messages) {
  const apiKey = getLLMApiKey()
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다. [빠른 설정]에서 API 키를 입력하세요.')
  }

  const provider = detectProvider(agent.model)
  addLog('debug', `LLM 호출: ${agent.model} (${provider}) — ${messages.length}개 메시지`)

  if (provider === 'anthropic') {
    return callAnthropic(agent, messages, apiKey)
  } else {
    return callOpenAI(agent, messages, apiKey)
  }
}

async function callAnthropic(agent, messages, apiKey) {
  const url = 'https://api.anthropic.com/v1/messages'

  // Anthropic은 system을 별도 필드로 전달
  const apiMessages = messages.map((m) => ({
    role: m.role === 'system' ? 'user' : m.role,
    content: m.content,
  }))

  const body = {
    model: agent.model,
    max_tokens: agent.maxTokens || 4096,
    messages: apiMessages,
  }

  if (agent.systemPrompt) {
    body.system = agent.systemPrompt
  }
  if (agent.temperature != null) {
    body.temperature = agent.temperature
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      errMsg = errBody.error?.message || errMsg
    } catch {}
    throw new Error(`Anthropic API 오류: ${errMsg}`)
  }

  const data = await res.json()
  const text = data.content?.map((c) => c.text).join('') || ''

  addLog('info', `Anthropic 응답: ${data.usage?.input_tokens || '?'}→${data.usage?.output_tokens || '?'} tokens`)
  return text
}

async function callOpenAI(agent, messages, apiKey) {
  const baseUrl = state.config.llm.baseUrl || 'https://api.openai.com/v1'
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  const apiMessages = []
  if (agent.systemPrompt) {
    apiMessages.push({ role: 'system', content: agent.systemPrompt })
  }
  for (const m of messages) {
    apiMessages.push({ role: m.role, content: m.content })
  }

  const body = {
    model: agent.model,
    messages: apiMessages,
  }

  if (agent.maxTokens) body.max_tokens = agent.maxTokens
  if (agent.temperature != null) body.temperature = agent.temperature

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      errMsg = errBody.error?.message || errMsg
    } catch {}
    throw new Error(`OpenAI API 오류: ${errMsg}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''

  addLog('info', `OpenAI 응답: ${data.usage?.prompt_tokens || '?'}→${data.usage?.completion_tokens || '?'} tokens`)
  return text
}

// ─── 세션 관리 (실제) ───

function generateSessionId() {
  return `ses-${crypto.randomBytes(4).toString('hex')}`
}

function createSession(agentId, channel, userId) {
  const agent = state.config.agents.find((a) => a.id === agentId)
  if (!agent) throw new Error(`에이전트를 찾을 수 없습니다: ${agentId}`)

  const session = {
    id: generateSessionId(),
    agentId: agent.id,
    agentName: agent.name,
    channel: channel || 'web',
    userId: userId || 'user-web',
    startedAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    status: 'active',
    messages: [],
  }
  state.sessions.push(session)
  addLog('info', `새 세션 시작: ${session.id} (${agent.name} via ${session.channel})`)
  broadcastEvent({ type: 'session.started', session: { ...session, messages: undefined } })
  return session
}

function endSession(session) {
  session.status = 'ended'
  session.endedAt = Date.now()
  state.agentStates[session.agentId] = 'idle'
  addLog('info', `세션 종료: ${session.id}`)
  broadcastEvent({ type: 'session.ended', sessionId: session.id, agentId: session.agentId })
  broadcastEvent({
    type: 'agent.state',
    agentId: session.agentId,
    agentName: session.agentName || session.agentId,
    state: 'idle',
  })
}

// 종료된 세션 정리 (최대 50개 유지)
function cleanupSessions() {
  const ended = state.sessions.filter((s) => s.status === 'ended')
  if (ended.length > 50) {
    const toRemove = ended.slice(0, ended.length - 50)
    state.sessions = state.sessions.filter((s) => !toRemove.includes(s))
  }
}

// ─── 데모 모드 시뮬레이션 (API 키 없을 때만) ───

const CHANNELS = ['discord', 'slack', 'telegram', 'web']
const SAMPLE_MESSAGES = [
  '오늘 날씨 알려줘',
  '파이썬 정렬 알고리즘 설명해줘',
  'React 18 변경사항 알려줘',
  'Docker 컨테이너 관리 방법',
]

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function simulateSessions() {
  if (!state.demoMode) return // 실제 모드에서는 시뮬레이션 안 함

  if (state.sessions.filter((s) => s.status === 'active').length < 5 && Math.random() < 0.3) {
    const agent = randomPick(state.config.agents)
    const session = {
      id: generateSessionId(),
      agentId: agent.id,
      agentName: agent.name,
      channel: randomPick(CHANNELS),
      userId: `user-${Math.floor(Math.random() * 100)}`,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 1,
      status: 'active',
      messages: [{ role: 'user', content: randomPick(SAMPLE_MESSAGES), timestamp: Date.now() }],
    }
    state.sessions.push(session)
    addLog('info', `[데모] 새 세션: ${session.id} (${agent.name} via ${session.channel})`)
    broadcastEvent({ type: 'session.started', session: { ...session, messages: undefined } })
  }

  for (const session of state.sessions) {
    if (session.status !== 'active') continue

    const agentState = Math.random() < 0.4 ? randomPick(['working', 'speaking', 'tool_calling']) : 'idle'
    const prevState = state.agentStates[session.agentId]
    state.agentStates[session.agentId] = agentState

    if (prevState !== agentState) {
      broadcastEvent({
        type: 'agent.state',
        agentId: session.agentId,
        agentName: session.agentName || session.agentId,
        state: agentState,
        sessionId: session.id,
        channel: session.channel,
      })
    }

    if (Math.random() < 0.2) {
      session.messageCount++
      session.lastActivity = Date.now()
    }

    if (Math.random() < 0.05 && Date.now() - session.startedAt > 10000) {
      endSession(session)
    }
  }

  cleanupSessions()
}

const LOG_MESSAGES_DEMO = [
  { level: 'debug', msg: 'Heartbeat ping 전송' },
  { level: 'info', msg: '[데모] 시뮬레이션 데이터 생성 중' },
  { level: 'warn', msg: 'API 키 미설정 — 데모 모드' },
]

function simulateLogs() {
  if (!state.demoMode) return
  if (Math.random() < 0.3) {
    const sample = randomPick(LOG_MESSAGES_DEMO)
    addLog(sample.level, sample.msg)
  }
}

// ─── 로그 시스템 ───

const LOG_LEVELS = ['debug', 'info', 'warn', 'error']

function addLog(level, message) {
  const entry = {
    timestamp: Date.now(),
    level,
    message,
    source: 'gateway',
  }
  state.logs.push(entry)
  if (state.logs.length > 1000) state.logs.shift()

  broadcastEvent({ type: 'log', ...entry })
}

// ─── WebSocket 서버 ───

let wss = null
const clients = new Set()
let logSubscribers = new Set()

function broadcastEvent(event) {
  const data = JSON.stringify(event)
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }
}

// ─── 시스템 메트릭 ───

let _prevCpu = process.cpuUsage()
let _prevCpuTime = Date.now()

function getCpuPercent() {
  const cur = process.cpuUsage(_prevCpu)
  const elapsed = (Date.now() - _prevCpuTime) * 1000
  _prevCpu = process.cpuUsage()
  _prevCpuTime = Date.now()
  if (elapsed <= 0) return 0
  return Math.min(100, Math.round(((cur.user + cur.system) / elapsed) * 100 * 10) / 10)
}

function getDiskUsage() {
  try {
    const output = execSync('df -B1 / 2>/dev/null || df -k / 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 3000,
    })
    const lines = output.trim().split('\n')
    if (lines.length < 2) return null
    const parts = lines[1].split(/\s+/)
    const total = parseInt(parts[1], 10)
    const used = parseInt(parts[2], 10)
    const free = parseInt(parts[3], 10)
    if (isNaN(total) || isNaN(used) || isNaN(free)) return null
    const multiplier = total < 10_000_000 ? 1024 : 1
    return { total: total * multiplier, used: used * multiplier, free: free * multiplier }
  } catch {
    return null
  }
}

// ─── RPC 핸들러 ───

const rpcHandlers = {
  // --- 시스템 ---
  health: () => {
    const mem = process.memoryUsage()
    const disk = getDiskUsage()
    const cpu = getCpuPercent()
    return {
      status: 'ok',
      version: '0.2.0',
      uptime: Math.floor((Date.now() - state.startedAt) / 1000),
      memoryUsage: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      cpuUsage: cpu,
      disk,
      activeConnections: clients.size,
      demoMode: state.demoMode,
    }
  },

  status: () => ({
    version: '0.2.0',
    uptime: Math.floor((Date.now() - state.startedAt) / 1000),
    channels: Object.entries(state.config.channels)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k),
    sessionsActive: state.sessions.filter((s) => s.status === 'active').length,
    agentCount: state.config.agents.length,
    demoMode: state.demoMode,
    llmAvailable: hasLLMApiKey(),
  }),

  'system.info': () => ({
    version: '0.2.0',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    demoMode: state.demoMode,
    llmAvailable: hasLLMApiKey(),
    llmProvider: hasLLMApiKey() ? detectProvider(state.config.agents[0]?.model || '') : null,
  }),

  // --- 설정 ---
  'config.schema': () => ({
    type: 'object',
    properties: {
      server: {
        type: 'object',
        title: '서버 설정',
        properties: {
          name: { type: 'string', title: '서버 이름', default: 'OpenClaw Gateway' },
          logLevel: { type: 'string', title: '로그 레벨', enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
          hotReload: { type: 'boolean', title: '핫 리로드', default: true },
        },
      },
      channels: {
        type: 'object',
        title: '채널 설정',
        properties: {
          discord: {
            type: 'object',
            title: 'Discord',
            properties: {
              enabled: { type: 'boolean', title: '활성화' },
              token: { type: 'string', title: '봇 토큰', format: 'password' },
              prefix: { type: 'string', title: '명령어 접두사', default: '!' },
            },
          },
          slack: {
            type: 'object',
            title: 'Slack',
            properties: {
              enabled: { type: 'boolean', title: '활성화' },
              botToken: { type: 'string', title: 'Bot Token', format: 'password' },
              appToken: { type: 'string', title: 'App Token', format: 'password' },
            },
          },
          telegram: {
            type: 'object',
            title: 'Telegram',
            properties: {
              enabled: { type: 'boolean', title: '활성화' },
              botToken: { type: 'string', title: 'Bot Token', format: 'password' },
            },
          },
        },
      },
      security: {
        type: 'object',
        title: '보안 설정',
        properties: {
          allowAnonymous: { type: 'boolean', title: '익명 접근 허용' },
          cors: {
            type: 'object',
            title: 'CORS',
            properties: {
              enabled: { type: 'boolean', title: 'CORS 활성화' },
              origins: { type: 'array', items: { type: 'string' }, title: '허용 오리진' },
            },
          },
          rateLimit: {
            type: 'object',
            title: 'Rate Limiting',
            properties: {
              enabled: { type: 'boolean', title: '활성화' },
              maxRequests: { type: 'number', title: '최대 요청 수' },
              windowSeconds: { type: 'number', title: '시간 윈도우 (초)' },
            },
          },
        },
      },
    },
  }),

  'config.get': () => ({
    config: state.config,
    hash: state.configHash,
  }),

  'config.patch': (params) => {
    if (params?.baseHash && params.baseHash !== state.configHash) {
      throw new Error(`base-hash conflict: expected ${params.baseHash}, current ${state.configHash}`)
    }
    if (params?.changes) {
      deepMerge(state.config, params.changes)
      computeConfigHash()
      updateDemoMode()
      addLog('info', '설정이 패치되었습니다')
    }
    return { config: state.config, hash: state.configHash }
  },

  'config.set': (params) => {
    if (params?.config) {
      state.config = deepMerge(state.config, params.config)
      computeConfigHash()
      updateDemoMode()
      addLog('info', '설정이 업데이트되었습니다')
    }
    return { config: state.config, hash: state.configHash }
  },

  'config.apply': () => {
    updateDemoMode()
    addLog('info', '설정 적용 완료 (핫 리로드)')
    broadcastEvent({ type: 'config.applied', hash: state.configHash })
    return { success: true, hash: state.configHash }
  },

  // --- 세션 ---
  'sessions.list': () =>
    state.sessions
      .filter((s) => s.status === 'active')
      .map((s) => ({
        id: s.id,
        agentId: s.agentId,
        agentName: s.agentName,
        channel: s.channel,
        userId: s.userId,
        startedAt: s.startedAt,
        lastActivity: s.lastActivity,
        messageCount: s.messageCount,
        status: s.status,
      })),

  'sessions.get': (params) => {
    const session = state.sessions.find((s) => s.id === params?.id)
    if (!session) throw new Error('세션을 찾을 수 없습니다')
    return session
  },

  'sessions.kill': (params) => {
    const session = state.sessions.find((s) => s.id === params?.id)
    if (!session) throw new Error('세션을 찾을 수 없습니다')
    endSession(session)
    return { success: true }
  },

  // --- 채팅 (실제 LLM) ---
  'chat.send': async (params) => {
    const { message, agentId, sessionId, userId, channel } = params || {}
    if (!message) throw new Error('message 파라미터가 필요합니다')

    // 세션 찾기 또는 생성
    let session
    if (sessionId) {
      session = state.sessions.find((s) => s.id === sessionId && s.status === 'active')
      if (!session) throw new Error('세션을 찾을 수 없습니다')
    } else {
      const targetAgentId = agentId || state.config.agents[0]?.id
      if (!targetAgentId) throw new Error('에이전트가 없습니다')
      session = createSession(targetAgentId, channel || 'web', userId || 'user-web')
    }

    // 유저 메시지 추가
    session.messages.push({ role: 'user', content: message, timestamp: Date.now() })
    session.messageCount++
    session.lastActivity = Date.now()

    // 에이전트 상태: working
    state.agentStates[session.agentId] = 'working'
    broadcastEvent({
      type: 'agent.state',
      agentId: session.agentId,
      agentName: session.agentName,
      state: 'working',
      sessionId: session.id,
      channel: session.channel,
    })

    const agent = state.config.agents.find((a) => a.id === session.agentId)
    if (!agent) throw new Error('에이전트 설정을 찾을 수 없습니다')

    try {
      // LLM 호출
      const chatMessages = session.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await callLLM(agent, chatMessages)

      // 어시스턴트 응답 추가
      session.messages.push({ role: 'assistant', content: response, timestamp: Date.now() })
      session.messageCount++
      session.lastActivity = Date.now()

      // 에이전트 상태: idle
      state.agentStates[session.agentId] = 'idle'
      broadcastEvent({
        type: 'agent.state',
        agentId: session.agentId,
        agentName: session.agentName,
        state: 'idle',
        sessionId: session.id,
        channel: session.channel,
      })

      addLog('info', `에이전트 응답 완료: ${session.id} (${agent.name})`)

      return {
        sessionId: session.id,
        agentId: session.agentId,
        agentName: session.agentName,
        response,
        messageCount: session.messageCount,
      }
    } catch (err) {
      // 에이전트 상태: error
      state.agentStates[session.agentId] = 'error'
      broadcastEvent({
        type: 'agent.state',
        agentId: session.agentId,
        agentName: session.agentName,
        state: 'error',
        sessionId: session.id,
        channel: session.channel,
      })
      addLog('error', `LLM 호출 실패: ${err.message}`)
      throw err
    }
  },

  'chat.history': (params) => {
    const session = state.sessions.find((s) => s.id === params?.sessionId)
    if (!session) throw new Error('세션을 찾을 수 없습니다')
    return {
      sessionId: session.id,
      agentId: session.agentId,
      agentName: session.agentName,
      messages: session.messages,
      messageCount: session.messageCount,
    }
  },

  // --- 로그 ---
  'logs.recent': (params) => {
    const count = params?.lines || 100
    const level = params?.level || 'all'
    let filtered = state.logs
    if (level !== 'all') {
      const idx = LOG_LEVELS.indexOf(level)
      filtered = state.logs.filter((l) => LOG_LEVELS.indexOf(l.level) >= idx)
    }
    return filtered.slice(-count)
  },

  'logs.subscribe': () => ({ subscribed: true }),

  // --- 모델 ---
  'models.list': () => [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', contextWindow: 200000 },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1000000 },
  ],

  // --- 에이전트 ---
  'agents.list': () =>
    state.config.agents.map((a) => ({
      ...a,
      state: state.agentStates[a.id] || 'idle',
    })),

  'agents.get': (params) => {
    const agent = state.config.agents.find((a) => a.id === params?.id)
    if (!agent) throw new Error('에이전트를 찾을 수 없습니다')
    return { ...agent, state: state.agentStates[agent.id] || 'idle' }
  },
}

// ─── 유틸 ───

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// ─── 서버 시작 ───

export function startGateway(config) {
  // config 적용
  if (config?.gateway) {
    state.config.gateway = { ...state.config.gateway, ...config.gateway }
  }
  if (config?.api?.key) {
    state.config.llm.apiKey = config.api.key
    state.config.security.apiToken = config.api.key
  }

  // 환경변수에서 API 키 로드
  if (process.env.ANTHROPIC_API_KEY && !state.config.llm.apiKey) {
    state.config.llm.apiKey = process.env.ANTHROPIC_API_KEY
    state.config.llm.provider = 'anthropic'
  }
  if (process.env.OPENAI_API_KEY && !state.config.llm.apiKey) {
    state.config.llm.apiKey = process.env.OPENAI_API_KEY
    state.config.llm.provider = 'openai'
  }
  if (process.env.LLM_BASE_URL) {
    state.config.llm.baseUrl = process.env.LLM_BASE_URL
  }

  // 데모 모드 결정
  updateDemoMode()

  const port = state.config.gateway.port || 18789
  const token = state.config.gateway.token || ''

  wss = new WebSocketServer({ port })

  wss.on('listening', () => {
    console.log(`[OpenClaw] Gateway v0.2.0 시작됨`)
    console.log(`[OpenClaw] WebSocket 서버: ws://0.0.0.0:${port}`)
    if (token) {
      console.log(`[OpenClaw] 인증 토큰: ${token.slice(0, 4)}${'*'.repeat(Math.max(0, token.length - 4))}`)
    } else {
      console.log(`[OpenClaw] 인증 토큰: 없음 (모든 연결 허용)`)
    }
    console.log(`[OpenClaw] 에이전트 ${state.config.agents.length}개 로드됨`)
    console.log(`[OpenClaw] LLM 모드: ${state.demoMode ? '❌ 데모 (API 키 미설정)' : '✅ 실제 LLM 연동'}`)
    if (hasLLMApiKey()) {
      const provider = detectProvider(state.config.agents[0]?.model || '')
      console.log(`[OpenClaw] LLM 프로바이더: ${provider}`)
    }
    addLog('info', 'Gateway 시작 완료')
    if (state.demoMode) {
      addLog('warn', 'API 키 미설정 — 데모 모드로 실행. ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 환경변수를 설정하세요.')
    }
  })

  wss.on('connection', (ws, req) => {
    // 토큰 인증
    if (token) {
      const authHeader = req.headers.authorization || ''
      const bearerToken = authHeader.replace('Bearer ', '')
      if (bearerToken !== token) {
        ws.close(4001, 'Unauthorized')
        addLog('warn', `인증 실패: ${req.socket.remoteAddress}`)
        return
      }
    }

    clients.add(ws)
    addLog('info', `클라이언트 연결: ${req.socket.remoteAddress} (총 ${clients.size}개)`)

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (!msg.id || !msg.method) {
          ws.send(JSON.stringify({ error: 'Invalid RPC message' }))
          return
        }

        const handler = rpcHandlers[msg.method]
        if (!handler) {
          ws.send(JSON.stringify({ id: msg.id, error: `Unknown method: ${msg.method}` }))
          addLog('warn', `알 수 없는 RPC 메서드: ${msg.method}`)
          return
        }

        try {
          // async/sync 핸들러 모두 지원
          const result = await handler(msg.params)
          ws.send(JSON.stringify({ id: msg.id, result }))
        } catch (err) {
          ws.send(JSON.stringify({ id: msg.id, error: err.message }))
        }
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
      logSubscribers.delete(ws)
      addLog('info', `클라이언트 연결 해제 (총 ${clients.size}개)`)
    })

    ws.on('error', () => {
      clients.delete(ws)
    })
  })

  // 데모 모드: 시뮬레이션 타이머
  setInterval(() => simulateSessions(), 3000)
  setInterval(() => simulateLogs(), 5000)

  // 세션 정리 (1분마다)
  setInterval(() => cleanupSessions(), 60000)

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[OpenClaw] SIGTERM 수신, 종료 중...')
    wss.close()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('[OpenClaw] SIGINT 수신, 종료 중...')
    wss.close()
    process.exit(0)
  })
}
