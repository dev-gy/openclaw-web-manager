# OWM (OpenClaw Web Manager) 설치 가이드

## 방법 A. curl 원라이너 (가장 간편)

```bash
curl -fsSL https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/install.sh | bash
```

> **Playground:**
> ```bash
> curl -fsSL http://localhost:9999/install.sh | bash
> ```

설치 경로 변경: `INSTALL_DIR=/my/path curl -fsSL ... | bash`

---

## 방법 B. npx (Node.js 프로젝트)

```bash
npx @openclaw/create-app
```

> npm에 publish 후 사용 가능

---

## 방법 C. Docker (프로덕션 권장)

```bash
curl -O https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/docker-compose.yml
docker compose up -d
```

LLM API 키 추가: `ANTHROPIC_API_KEY=sk-ant-... docker compose up -d`

---

## 방법 D. git clone 수동 설치

### 전제조건
- Node.js 22+ / npm 10+ / git

### Step 1. 소스 다운로드

```bash
git clone https://github.com/dev-gy/openclaw-web-manager.git /opt/owm
cd /opt/owm
```

> **Playground:** `git clone /opt/owm-repo.git /opt/owm`

### Step 2. OWM 빌드

```bash
npm install
npm run build
```

### Step 3. OpenClaw Gateway 설치

```bash
cd /opt/owm/gateway
npm install
ln -sf /opt/owm/gateway/cli.js /usr/local/bin/openclaw
chmod +x /usr/local/bin/openclaw
openclaw --version
```

### Step 4. 실행

```bash
export GATEWAY_TOKEN=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c32)

# Gateway
openclaw gateway --port 18789 --token "$GATEWAY_TOKEN" &

# OWM 서버
cd /opt/owm
export OPENCLAW_WS_URL="ws://127.0.0.1:18789"
export OPENCLAW_TOKEN="$GATEWAY_TOKEN"
export PORT=3000 HOST=0.0.0.0
export OWM_DB_PATH=/opt/owm/data/owm.db
export OWM_ADMIN_PASS=admin
mkdir -p data
node dist/server/index.mjs
```

### Step 5. 접속

http://localhost:3000 (admin / admin)
