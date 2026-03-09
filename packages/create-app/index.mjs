#!/usr/bin/env node
// ============================================================
//  npx @openclaw/create-app [directory]
//  OpenClaw Web Manager 원클릭 설치 CLI
// ============================================================
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const REPO = "https://github.com/dev-gy/openclaw-web-manager.git";
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function info(msg) { console.log(`${C.cyan}[OWM]${C.reset} ${msg}`); }
function ok(msg) { console.log(`${C.green}[OWM]${C.reset} ✓ ${msg}`); }
function warn(msg) { console.log(`${C.yellow}[OWM]${C.reset} ⚠ ${msg}`); }
function fail(msg) { console.error(`${C.red}[OWM]${C.reset} ✗ ${msg}`); process.exit(1); }

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf-8", ...opts }).trim();
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("");
  console.log(`${C.bold}${C.cyan}  OpenClaw Web Manager — Installer${C.reset}`);
  console.log("");

  // 1. 전제조건 확인
  info("전제조건 확인 중...");
  try { run("git --version"); } catch { fail("git이 필요합니다."); }
  try {
    const nodeVer = run("node -v").replace("v", "");
    const major = parseInt(nodeVer.split(".")[0]);
    if (major < 20) fail(`Node.js 20+ 필요 (현재: v${nodeVer})`);
    ok(`Node.js v${nodeVer}`);
  } catch { fail("Node.js가 필요합니다."); }

  // 2. 설치 경로
  let targetDir = process.argv[2] || "";
  if (!targetDir) {
    targetDir = await ask(`${C.cyan}[OWM]${C.reset} 설치 경로 (기본: ./owm): `) || "owm";
  }
  targetDir = resolve(process.cwd(), targetDir);
  const dirName = basename(targetDir);

  if (existsSync(resolve(targetDir, "package.json"))) {
    warn(`${targetDir} 이미 존재합니다.`);
    const answer = await ask(`${C.cyan}[OWM]${C.reset} 업데이트할까요? (y/N): `);
    if (answer.toLowerCase() !== "y") process.exit(0);
  }

  // 3. git clone
  const repoUrl = process.env.OWM_REPO_URL || REPO;
  if (existsSync(resolve(targetDir, ".git"))) {
    info("기존 저장소 업데이트 중...");
    run("git pull --ff-only", { cwd: targetDir });
  } else {
    info(`소스 다운로드: ${repoUrl}`);
    run(`git clone ${repoUrl} "${targetDir}"`);
  }
  ok("소스 다운로드 완료");

  // 4. OWM 빌드
  info("OWM 의존성 설치 중...");
  execSync("npm install", { cwd: targetDir, stdio: "inherit" });

  info("OWM 빌드 중...");
  execSync("npm run build", { cwd: targetDir, stdio: "inherit" });
  ok("OWM 빌드 완료");

  // 5. Gateway 설치
  info("OpenClaw Gateway 설치 중...");
  const gwDir = resolve(targetDir, "gateway");
  execSync("npm install", { cwd: gwDir, stdio: "inherit" });
  ok("Gateway 설치 완료");

  // 6. .env 생성
  const token = randomBytes(16).toString("hex");
  const envContent = `# OWM 환경 설정 (자동 생성)
GATEWAY_TOKEN=${token}
OPENCLAW_WS_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=${token}
PORT=3000
HOST=0.0.0.0
OWM_DB_PATH=${targetDir}/data/owm.db
OWM_ADMIN_PASS=admin
`;
  mkdirSync(resolve(targetDir, "data"), { recursive: true });
  writeFileSync(resolve(targetDir, ".env"), envContent);
  ok(".env 생성 완료");

  // 7. 완료 메시지
  console.log("");
  console.log(`${C.green}${"=".repeat(50)}`);
  console.log(`  ✓ OWM 설치 완료!`);
  console.log(`${"=".repeat(50)}${C.reset}`);
  console.log("");
  console.log("  실행 방법:");
  console.log("");
  console.log(`    cd ${dirName}`);
  console.log(`    source .env`);
  console.log(`    node gateway/cli.js gateway --port 18789 --token $GATEWAY_TOKEN &`);
  console.log(`    node dist/server/index.mjs`);
  console.log("");
  console.log(`  접속: http://localhost:3000 (admin / admin)`);
  console.log("");
}

main().catch((err) => { fail(err.message); });
