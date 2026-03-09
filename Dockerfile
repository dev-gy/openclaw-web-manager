# ============================================================
# OpenClaw Web Manager — Multi-stage Production Dockerfile
# ============================================================

# ── Stage 1: Builder ──
FROM node:22-alpine AS builder

WORKDIR /build

# 의존성 설치 (레이어 캐싱)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 & 빌드
COPY . .
RUN npm run build

# ── Stage 2: Production Runtime ──
FROM node:22-alpine

LABEL maintainer="OpenClaw Team"
LABEL description="OpenClaw Web Manager — Gamified AI Agent Management UI"

WORKDIR /app

# 시스템 유틸 설치 (df 명령 등 — 게이트웨이 health 메트릭에 필요)
RUN apk add --no-cache coreutils

# ── OpenClaw Gateway 설치 ──
COPY gateway/ /opt/openclaw/
RUN cd /opt/openclaw && npm install --omit=dev \
  && printf '#!/bin/sh\ncd /opt/openclaw && exec node cli.js "$@"\n' > /usr/local/bin/openclaw \
  && chmod +x /usr/local/bin/openclaw

# ── OWM 프로덕션 의존성만 설치 ──
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── 빌드 아티팩트 복사 ──
COPY --from=builder /build/dist ./dist

# ── 데이터 디렉토리 (SQLite DB, PID 파일 등) ──
RUN mkdir -p /app/data

# ── 환경 변수 기본값 ──
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV OWM_DB_PATH=/app/data/owm.db

# 포트 노출
EXPOSE 3000
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# ── 엔트리포인트 ──
# 게이트웨이 + OWM 서버를 함께 실행하는 스크립트
COPY docker-entrypoint.sh /usr/local/bin/
# Windows CRLF→LF 변환 + 실행 권한
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
