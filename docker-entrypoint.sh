#!/bin/sh
set -e

echo "======================================"
echo "  OpenClaw Web Manager v0.1.0"
echo "======================================"

# ── 런타임 환경 자동 생성/보존 ──
RUNTIME_ENV_FILE="/app/data/runtime.env"

if [ -f "$RUNTIME_ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV_FILE"
fi

if [ -z "${OWM_COOKIE_SECRET:-}" ]; then
  OWM_COOKIE_SECRET="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 48 | head -n1)"
fi

if [ -z "${OWM_ADMIN_PASS:-}" ]; then
  OWM_ADMIN_PASS="admin"
fi

mkdir -p /app/data
cat > "$RUNTIME_ENV_FILE" <<EOF
OWM_COOKIE_SECRET=$OWM_COOKIE_SECRET
OWM_ADMIN_PASS=$OWM_ADMIN_PASS
EOF

export OWM_COOKIE_SECRET
export OWM_ADMIN_PASS

# ── 게이트웨이 토큰 ──
GATEWAY_TOKEN="${OWM_GATEWAY_TOKEN:-$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n1)}"
GATEWAY_PORT="${OWM_GATEWAY_PORT:-18789}"

echo "[OWM] Gateway port : ${GATEWAY_PORT}"
echo "[OWM] Gateway token: ${GATEWAY_TOKEN:0:4}****"
echo "[OWM] OWM port     : ${PORT:-3000}"
echo "[OWM] DB path      : ${OWM_DB_PATH:-/app/data/owm.db}"
echo "[OWM] Admin user   : admin"
echo "[OWM] Admin pass   : ${OWM_ADMIN_PASS:0:2}****"
echo "[OWM] Cookie secret: ${OWM_COOKIE_SECRET:0:4}****"

# ── LLM API 키 상태 ──
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[OWM] LLM API key  : Anthropic (${ANTHROPIC_API_KEY:0:8}...)"
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "[OWM] LLM API key  : OpenAI (${OPENAI_API_KEY:0:8}...)"
else
  echo "[OWM] LLM API key  : ⚠ 미설정 (데모 모드)"
fi

# ── 게이트웨이 환경변수 설정 (OWM 자동 연결용) ──
export OPENCLAW_WS_URL="ws://127.0.0.1:${GATEWAY_PORT}"
export OPENCLAW_TOKEN="${GATEWAY_TOKEN}"

# ── OpenClaw Gateway 백그라운드 실행 ──
echo "[OWM] Starting OpenClaw Gateway..."
openclaw gateway --port "${GATEWAY_PORT}" --token "${GATEWAY_TOKEN}" &
GATEWAY_PID=$!
echo "[OWM] Gateway PID: ${GATEWAY_PID}"

# 게이트웨이 준비 대기 (최대 10초)
echo "[OWM] Waiting for Gateway to be ready..."
for i in $(seq 1 20); do
  if kill -0 "$GATEWAY_PID" 2>/dev/null; then
    sleep 0.5
    # 간단 포트 체크
    if wget -qO /dev/null "http://127.0.0.1:${GATEWAY_PORT}" 2>/dev/null || [ $i -ge 6 ]; then
      echo "[OWM] Gateway ready (waited ${i}x0.5s)"
      break
    fi
  else
    echo "[OWM] ERROR: Gateway failed to start"
    exit 1
  fi
done

# ── OWM 서버 실행 ──
echo "[OWM] Starting OWM server..."
exec node dist/server/index.mjs
