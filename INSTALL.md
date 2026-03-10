# OWM (OpenClaw Web Manager) 설치 가이드

## 방법 A. Docker One-liner (Grafana 스타일)

```bash
docker run -d --name owm-server \
  -p 3000:3000 \
  -e OWM_COOKIE_SECRET='replace-with-long-random-secret' \
  -e OWM_ADMIN_PASS='replace-admin-password' \
  -v owm-data:/app/data \
  ghcr.io/dev-gy/openclaw-web-manager:latest
```

로그/상태:

```bash
docker logs -f owm-server
docker ps | grep owm-server
curl http://127.0.0.1:3000/api/health
```

업데이트:

```bash
docker pull ghcr.io/dev-gy/openclaw-web-manager:latest
docker rm -f owm-server
docker run -d --name owm-server \
  -p 3000:3000 \
  -e OWM_COOKIE_SECRET='replace-with-long-random-secret' \
  -e OWM_ADMIN_PASS='replace-admin-password' \
  -v owm-data:/app/data \
  ghcr.io/dev-gy/openclaw-web-manager:latest
```

---

## 방법 B. curl 원라이너 (호스트 설치)

```bash
curl -fsSL https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/install.sh | bash
```

권장(권한 이슈 방지):

```bash
curl -fsSL https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/install.sh | sudo bash
```

> **Playground:**
> ```bash
> curl -fsSL http://localhost:9999/install.sh | bash
> ```

설치 경로 변경: `INSTALL_DIR=/my/path curl -fsSL ... | sudo bash`

설치가 끝나면 systemd 서비스(`owm`)가 자동 등록/시작됩니다.

```bash
owmctl status
owmctl logs
```

---

## 방법 C. npx (Node.js 프로젝트)

```bash
npx @openclaw/create-app
```

> npm에 publish 후 사용 가능

---

## 방법 D. Docker Compose (소스 기반)

```bash
curl -O https://raw.githubusercontent.com/dev-gy/openclaw-web-manager/main/docker-compose.yml
docker compose up -d
```

LLM API 키 추가: `ANTHROPIC_API_KEY=sk-ant-... docker compose up -d`

---

## 방법 E. git clone 수동 설치

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
cat >/etc/systemd/system/owm.service <<EOF
[Unit]
Description=OpenClaw Web Manager
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/owm
EnvironmentFile=/opt/owm/.env
ExecStart=/usr/bin/env node dist/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now owm
```

### Step 5. 접속

http://localhost:3000 (admin / admin)

로그인 후 `서버 > 대상 서버`에서 원격 Gateway를 등록하세요.
