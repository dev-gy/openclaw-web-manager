#!/usr/bin/env bash
# ============================================================
#  OWM (OpenClaw Web Manager) — One-line Installer
# ============================================================
#  실제:      curl -fsSL https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/install.sh | bash
#  Playground: curl -fsSL http://localhost:9999/install.sh | bash
# ============================================================
set -euo pipefail

OWM_VERSION="${OWM_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/owm}"
REPO_URL="${OWM_REPO_URL:-https://github.com/dev-gy/openclaw-web-manager.git}"
SERVICE_NAME="${OWM_SERVICE_NAME:-owm}"
OS_NAME="$(uname -s)"
IS_LINUX=0
IS_MACOS=0
HAS_SYSTEMD=0
HAS_LAUNCHD=0

if [ "$OS_NAME" = "Linux" ]; then
  IS_LINUX=1
elif [ "$OS_NAME" = "Darwin" ]; then
  IS_MACOS=1
fi

if [ "$IS_LINUX" -eq 1 ] && command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  HAS_SYSTEMD=1
fi

if [ "$IS_MACOS" -eq 1 ] && command -v launchctl >/dev/null 2>&1; then
  HAS_LAUNCHD=1
fi

# --- 색상 ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[OWM]${NC} $*"; }
ok()    { echo -e "${GREEN}[OWM]${NC} ✓ $*"; }
warn()  { echo -e "${YELLOW}[OWM]${NC} ⚠ $*"; }
fail()  { echo -e "${RED}[OWM]${NC} ✗ $*"; exit 1; }

if [ "$IS_LINUX" -eq 0 ] && [ "$IS_MACOS" -eq 0 ]; then
  fail "지원하지 않는 OS입니다: $OS_NAME (지원: Linux, macOS)"
fi

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    sh -c "$*"
  elif command -v sudo >/dev/null 2>&1; then
    sudo sh -c "$*"
  else
    fail "루트 권한이 필요합니다. sudo를 설치하거나 root로 실행하세요."
  fi
}

copy_with_root() {
  local src="$1"
  local dst="$2"
  if [ "$(id -u)" -eq 0 ]; then
    cp "$src" "$dst"
  elif command -v sudo >/dev/null 2>&1; then
    sudo cp "$src" "$dst"
  else
    fail "파일 복사를 위해 루트 권한이 필요합니다: $dst"
  fi
}

# ============================================================
# 1. 전제조건 확인
# ============================================================
info "전제조건 확인 중..."

command -v node >/dev/null 2>&1 || fail "Node.js가 필요합니다. https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "npm이 필요합니다."
command -v git  >/dev/null 2>&1 || fail "git이 필요합니다."

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js 20+ 필요 (현재: $(node -v))"

ok "Node.js $(node -v), npm $(npm -v), git $(git --version | cut -d' ' -f3)"

# ============================================================
# 2. 소스 다운로드
# ============================================================
if [ -d "$INSTALL_DIR/.git" ]; then
  warn "$INSTALL_DIR 이미 존재 — git pull로 업데이트"
  cd "$INSTALL_DIR" && git pull --ff-only
else
  info "소스 다운로드: $REPO_URL → $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

if [ "$OWM_VERSION" != "latest" ]; then
  info "버전 전환: $OWM_VERSION"
  git checkout "$OWM_VERSION"
fi

ok "소스 다운로드 완료 ($(git describe --tags 2>/dev/null || git rev-parse --short HEAD))"

# ============================================================
# 3. OWM 빌드
# ============================================================
info "OWM 의존성 설치 중..."
npm install --loglevel=error

info "OWM 빌드 중..."
npm run build

ok "OWM 빌드 완료"

# ============================================================
# 4. 초기 설정 (OWM 단독)
# ============================================================
mkdir -p "$INSTALL_DIR/data"

cd "$INSTALL_DIR"
COOKIE_SECRET="${OWM_COOKIE_SECRET:-$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c48 || true)}"
ADMIN_PASS="${OWM_ADMIN_PASS:-admin}"

if [ ! -f "$INSTALL_DIR/.env" ]; then
cat > "$INSTALL_DIR/.env" <<EOF
# OWM 환경 설정 (자동 생성)
PORT=3000
HOST=0.0.0.0
OWM_DB_PATH=$INSTALL_DIR/data/owm.db
OWM_ADMIN_PASS=$ADMIN_PASS
OWM_COOKIE_SECRET=$COOKIE_SECRET

# 선택: 자동 연결 기본값 (없어도 OWM 실행 가능)
# OPENCLAW_WS_URL=ws://gateway-host:18789
# OPENCLAW_TOKEN=your-gateway-token
EOF
  ok ".env 생성 완료"
else
  warn ".env 이미 존재 — 기존 설정을 유지합니다"
  EXISTING_ADMIN_PASS="$(grep -E '^OWM_ADMIN_PASS=' "$INSTALL_DIR/.env" | tail -n1 | cut -d= -f2- || true)"
  EXISTING_COOKIE_SECRET="$(grep -E '^OWM_COOKIE_SECRET=' "$INSTALL_DIR/.env" | tail -n1 | cut -d= -f2- || true)"
  if [ -n "$EXISTING_ADMIN_PASS" ]; then
    ADMIN_PASS="$EXISTING_ADMIN_PASS"
  fi
  if [ -n "$EXISTING_COOKIE_SECRET" ]; then
    COOKIE_SECRET="$EXISTING_COOKIE_SECRET"
  fi
fi

# ============================================================
# 5. 서비스 등록/자동 시작
# ============================================================
if [ "$HAS_SYSTEMD" -eq 1 ]; then
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  TMP_SERVICE_FILE="$(mktemp)"

  cat > "$TMP_SERVICE_FILE" <<EOF
[Unit]
Description=OpenClaw Web Manager
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/env node dist/server/index.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

  copy_with_root "$TMP_SERVICE_FILE" "$SERVICE_FILE"
  rm -f "$TMP_SERVICE_FILE"
  run_as_root "chmod 644 '$SERVICE_FILE'"
  run_as_root "systemctl daemon-reload"
  run_as_root "systemctl enable --now '$SERVICE_NAME'"
  ok "systemd 서비스 등록 및 시작 완료: $SERVICE_NAME"

  TMP_CTL_FILE="$(mktemp)"
  cat > "$TMP_CTL_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SERVICE_NAME="${OWM_SERVICE_NAME:-owm}"

run_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    "$@"
  fi
}

case "${1:-status}" in
  start|stop|restart|status)
    run_cmd systemctl "$1" "$SERVICE_NAME"
    ;;
  logs)
    run_cmd journalctl -u "$SERVICE_NAME" -f --no-pager
    ;;
  enable|disable)
    run_cmd systemctl "$1" "$SERVICE_NAME"
    ;;
  *)
    echo "Usage: owmctl {start|stop|restart|status|logs|enable|disable}"
    exit 1
    ;;
esac
EOF
  copy_with_root "$TMP_CTL_FILE" "/usr/local/bin/owmctl"
  rm -f "$TMP_CTL_FILE"
  run_as_root "chmod 755 /usr/local/bin/owmctl"
  ok "관리 명령 설치 완료: owmctl"
elif [ "$HAS_LAUNCHD" -eq 1 ]; then
  LAUNCHD_LABEL="com.openclaw.${SERVICE_NAME}"
  LAUNCHD_DIR="$HOME/Library/LaunchAgents"
  LAUNCHD_FILE="$LAUNCHD_DIR/${LAUNCHD_LABEL}.plist"
  mkdir -p "$LAUNCHD_DIR"

  TMP_PLIST_FILE="$(mktemp)"
  cat > "$TMP_PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCHD_LABEL</string>
  <key>WorkingDirectory</key>
  <string>$INSTALL_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>dist/server/index.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>3000</string>
    <key>HOST</key>
    <string>0.0.0.0</string>
    <key>OWM_DB_PATH</key>
    <string>$INSTALL_DIR/data/owm.db</string>
    <key>OWM_ADMIN_PASS</key>
    <string>$ADMIN_PASS</string>
    <key>OWM_COOKIE_SECRET</key>
    <string>$COOKIE_SECRET</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$INSTALL_DIR/data/owm.log</string>
  <key>StandardErrorPath</key>
  <string>$INSTALL_DIR/data/owm-error.log</string>
</dict>
</plist>
EOF
  cp "$TMP_PLIST_FILE" "$LAUNCHD_FILE"
  rm -f "$TMP_PLIST_FILE"

  launchctl bootout "user/$(id -u)" "$LAUNCHD_FILE" >/dev/null 2>&1 || true
  launchctl bootstrap "user/$(id -u)" "$LAUNCHD_FILE"
  launchctl kickstart -k "user/$(id -u)/$LAUNCHD_LABEL"
  ok "launchd 서비스 등록 및 시작 완료: $LAUNCHD_LABEL"

  TMP_CTL_FILE="$(mktemp)"
  cat > "$TMP_CTL_FILE" <<EOF
#!/usr/bin/env bash
set -euo pipefail
LABEL="$LAUNCHD_LABEL"
PLIST_FILE="$LAUNCHD_FILE"
DOMAIN="user/\$(id -u)"

case "\${1:-status}" in
  start)
    launchctl bootstrap "\$DOMAIN" "\$PLIST_FILE" 2>/dev/null || true
    launchctl kickstart -k "\$DOMAIN/\$LABEL"
    ;;
  stop)
    launchctl bootout "\$DOMAIN" "\$PLIST_FILE" || true
    ;;
  restart)
    launchctl bootout "\$DOMAIN" "\$PLIST_FILE" || true
    launchctl bootstrap "\$DOMAIN" "\$PLIST_FILE"
    launchctl kickstart -k "\$DOMAIN/\$LABEL"
    ;;
  status)
    launchctl print "\$DOMAIN/\$LABEL"
    ;;
  logs)
    tail -f "$INSTALL_DIR/data/owm.log" "$INSTALL_DIR/data/owm-error.log"
    ;;
  *)
    echo "Usage: owmctl {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
EOF
  mkdir -p "$HOME/.local/bin"
  cp "$TMP_CTL_FILE" "$HOME/.local/bin/owmctl"
  rm -f "$TMP_CTL_FILE"
  chmod 755 "$HOME/.local/bin/owmctl"
  ok "관리 명령 설치 완료: $HOME/.local/bin/owmctl"
  warn "PATH에 ~/.local/bin 이 없으면 다음을 실행하세요: export PATH=\"\$HOME/.local/bin:\$PATH\""
else
  warn "자동 서비스 등록에 필요한 systemd/launchd를 찾지 못했습니다. 수동 실행을 사용하세요."
fi

# ============================================================
# 완료
# ============================================================
echo ""
echo -e "${GREEN}=============================================="
echo "  ✓ OWM 설치 완료!"
echo "==============================================${NC}"
echo ""
echo "  실행 상태:"
echo ""
if [ "$HAS_SYSTEMD" -eq 1 ]; then
echo "    owmctl status"
echo "    owmctl logs"
elif [ "$HAS_LAUNCHD" -eq 1 ]; then
echo "    ~/.local/bin/owmctl status"
echo "    ~/.local/bin/owmctl logs"
else
echo "    cd $INSTALL_DIR && source .env && node dist/server/index.mjs"
fi
echo ""
echo "  접속:"
echo "    http://localhost:3000  (admin / admin)"
echo ""
echo "  이후 [서버 > 대상 서버]에서 원격 OpenClaw Gateway를 등록/연결하세요."
echo ""
