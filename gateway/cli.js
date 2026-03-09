#!/usr/bin/env node

/**
 * OpenClaw CLI
 * Usage:
 *   openclaw --version
 *   openclaw gateway [--port 18789] [--token TOKEN] [--config PATH]
 */

import { startGateway } from './gateway.js'

const args = process.argv.slice(2)
const command = args[0]

function getArg(name, fallback) {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('openclaw 0.2.0')
  process.exit(0)
}

if (command === 'gateway') {
  const port = parseInt(getArg('--port', '18789'), 10)
  const token = getArg('--token', '')
  const configPath = getArg('--config', null)

  // config 파일이 있으면 로드
  let config = { gateway: { port, token } }
  if (configPath) {
    try {
      const fs = await import('node:fs')
      const raw = fs.default.readFileSync(configPath, 'utf8')
      config = JSON.parse(raw)
      // CLI 인자가 config 파일보다 우선
      if (args.includes('--port')) config.gateway.port = port
      if (args.includes('--token')) config.gateway.token = token
    } catch (err) {
      console.error(`[OpenClaw] Config 로드 실패: ${err.message}`)
    }
  }

  startGateway(config)
} else {
  console.log(`OpenClaw AI Agent Gateway v0.2.0

Usage:
  openclaw gateway [options]    Start the Gateway server
  openclaw --version            Show version

Gateway options:
  --port PORT     WebSocket port (default: 18789)
  --token TOKEN   Auth token
  --config PATH   Config file path (JSON)
`)
}
