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

### Step 3. 원격 Gateway 연결 준비

OWM은 별도 관리 서버이므로, OpenClaw 실행 바이너리 설치는 필수가 아닙니다.
대상 서버의 Gateway에 원격 연결해서 관리합니다.

### Step 4. 실행

```bash
cd /opt/owm
export PORT=3000 HOST=0.0.0.0
export OWM_DB_PATH=/opt/owm/data/owm.db
export OWM_ADMIN_PASS=admin
export OWM_COOKIE_SECRET=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c48)
mkdir -p data
node dist/server/index.mjs
```

### Step 5. 접속

http://localhost:3000 (admin / admin)

로그인 후 `서버 > 대상 서버`에서 원격 Gateway를 등록하세요.
