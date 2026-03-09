# 🐾 OpenClaw Web Manager (OWM)

OpenClaw을 로컬에서 손쉽게 설치, 설정, 모니터링할 수 있는 웹 기반 관리 프로그램.

## Tech Stack

- **Frontend**: Vike + React 19 + Tailwind CSS v4
- **Backend**: Fastify 5 + WebSocket
- **Database**: SQLite (sql.js)
- **Process Management**: systemd / direct child_process (환경 자동 감지)

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
pages/           Vike file-based routing
server/          Fastify backend
  routes/        REST API + WebSocket endpoints
  services/      ProcessManager, LocalInstaller, GatewayClient, EnvDetect
  db/            SQLite schema
components/      Shared React components
  ui/            UI 컴포넌트 라이브러리
hooks/           Custom React hooks (useWebSocket, useGatewayRpc, useProcessStatus)
layouts/         Layout components (Sidebar)
styles/          Tailwind CSS
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `OWM_COOKIE_SECRET` | — | Cookie signing secret |
| `OWM_ADMIN_USER` | `admin` | Default admin username |
| `OWM_ADMIN_PASS` | `admin` | Default admin password |
| `OWM_MASTER_KEY` | — | AES-256 key for credential encryption |
| `OWM_DB_PATH` | `./data/owm.db` | SQLite database path |
