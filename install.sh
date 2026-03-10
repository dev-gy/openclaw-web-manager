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

# --- 색상 ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[OWM]${NC} $*"; }
ok()    { echo -e "${GREEN}[OWM]${NC} ✓ $*"; }
warn()  { echo -e "${YELLOW}[OWM]${NC} ⚠ $*"; }
fail()  { echo -e "${RED}[OWM]${NC} ✗ $*"; exit 1; }

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
COOKIE_SECRET=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c48 || true)

cat > "$INSTALL_DIR/.env" <<EOF
# OWM 환경 설정 (자동 생성)
PORT=3000
HOST=0.0.0.0
OWM_DB_PATH=$INSTALL_DIR/data/owm.db
OWM_ADMIN_PASS=admin
OWM_COOKIE_SECRET=$COOKIE_SECRET

# 선택: 자동 연결 기본값 (없어도 OWM 실행 가능)
# OPENCLAW_WS_URL=ws://gateway-host:18789
# OPENCLAW_TOKEN=your-gateway-token
EOF

ok ".env 생성 완료"

# ============================================================
# 완료
# ============================================================
echo ""
echo -e "${GREEN}=============================================="
echo "  ✓ OWM 설치 완료!"
echo "==============================================${NC}"
echo ""
echo "  실행 방법:"
echo ""
echo "    # 1. OWM 서버 시작"
echo "    source $INSTALL_DIR/.env"
echo "    cd $INSTALL_DIR"
echo "    node dist/server/index.mjs"
echo ""
echo "    # 2. 접속"
echo "    http://localhost:3000  (admin / admin)"
echo ""
echo "  이후 [서버 > 대상 서버]에서 원격 OpenClaw Gateway를 등록/연결하세요."
echo ""
echo "  또는 한번에:"
echo "    cd $INSTALL_DIR && source .env && node dist/server/index.mjs"
echo ""
