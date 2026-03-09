# 의사결정 기록

프로젝트 전반의 주요 결정을 누적 기록한다.

---

## [DEC-001] 2026-03-08 — 멀티 에이전트 파이프라인 도입

**배경**: 단일 세션에서 기획/구현/검증을 모두 하면 자기 검증이 안 됨
**결정**: 5명 에이전트 분업 + 문서 기반 인수인계 + 컨텍스트 분리 파이프라인
**에이전트**: 기획자(+UI 아키텍트), 비평가, 프론트 개발자, 백엔드 개발자, QA
**검증 방식**: 도구 기반 객관적 측정 (빌드, 타입체크, Grep 검증)
**문서화**: 스프린트별 7개 문서 산출
**수정**: DEC-006에 의해 6명 → 5명으로 변경 (Designer → Planner 합병)

## [DEC-002] 2026-03-08 — UX 평가 결과 주요 문제점

**배경**: 16개 페이지 E2E 검증 완료 후 유저 관점 평가 수행
**발견된 문제**:
1. 에이전트 오피스(핵심 기능)가 빈 직사각형 5개 → 데모/프리뷰 필요
2. 페이지 이동 시 5~7초 로딩 → 즉시 렌더링 필요
3. 게이미피케이션이 표면적 (RPG 라벨만 있고 시각적 게임 요소 없음)
4. 캐릭터 시트에서 에이전트 전환 불가 (3명 있는데 1명만 표시)
5. 사이드바 메뉴 16개 → 과도한 정보량
**우선순위**: 추후 스프린트에서 결정

## [DEC-003] 2026-03-08 — 연결 상태 게이트: 중앙 리다이렉트 vs 페이지별 게이트

**배경**: 미설치/미연결 상태에서 빈 화면이 노출되는 문제 (Sprint-001)
**선택지**:
- A) `guard.ts`에서 중앙 리다이렉트 — 모든 페이지 전환 시 async API 호출 필요, 지연 발생
- B) 페이지별 `useConnectionStatus` + early return — 페이지마다 자체 판단, 부분 표시 가능
**결정**: B) 페이지별 게이트
**근거**:
- guard.ts의 async 호출은 SSR/CSR 모두에서 페이지 전환 지연 유발
- 설정/모니터링 인덱스는 미연결 시에도 부분 표시(Alert 배너 + opacity-50)가 UX상 유리
- `SetupRequired` 컴포넌트 3-variant로 상태별 CTA 통일
**결과**: 17개 페이지에 게이트 패턴 적용, 예외 3개(login, setup, connection) 미적용

## [DEC-004] 2026-03-08 — 에이전트 자기검증: 근거 태그 + 오케스트레이터 교차검증

**배경**: 에이전트가 잘못된 주장을 하면 파이프라인 전체가 오염됨
**결정**: A+C 조합 — 에이전트가 `[근거:]` 태그로 증거 제시 + 오케스트레이터가 Phase 2a/5a에서 교차검증
**적용**:
- Critic: 모든 지적에 `[근거: Grep/WebSearch 결과]` 필수, 미확인 시 심각도 "낮음" 제한
- QA: FAIL 전 Grep 재탐색, PASS 전 Read 재확인
- 오케스트레이터: 근거 없는 "높음" 지적 제거, FAIL 항목 측정값 재검증

## [DEC-005] 2026-03-08 — 스프린트 상태 추적: .state.json + 자동 복구

**배경**: 오토컴팩트로 컨텍스트 손실 시 스프린트 진행 상태를 복구할 수 없음
**결정**: 각 스프린트 폴더에 `.state.json` 배치, Phase 완료마다 업데이트
**구조**: topic, status, currentPhase, retryCount, completedPhases, timestamps
**복구**: `/sprint resume` 명령으로 running 상태 스프린트의 currentPhase부터 재개

## [DEC-006] 2026-03-08 — Designer 에이전트를 Planner에 합병

**배경**: Sprint-001 실행 후 각 에이전트의 실제 성과를 평가한 결과, Designer 에이전트의 독립적 가치가 없음을 확인
**문제점**:
1. Designer의 유일한 산출물(03-spec-revised.md UI 설계 섹션)이 Planner의 스펙 수정과 완전히 겹침
2. Phase 3에서 항상 "PLANNER + DESIGNER" 공동 실행 — 독립적 판단 지점 없음
3. 실제 시각적 설계(와이어프레임, 목업, 색상 선택)가 아닌 "스펙 텍스트 수정"만 수행
4. Generator-Critic 패턴에서 Designer는 Generator도 Critic도 아닌 모호한 위치
**조사**:
- MetaGPT 연구: "Agent 수가 적을수록 coordination overhead 감소"
- Claude Code Builder-Validator 패턴: 생성자(1)+검증자(1)가 최소 단위
- 업계 합의: UX 기획과 UI 설계가 분리되려면 시각적 도구(Figma 등) 접근 필요 — 텍스트만으로는 분리 불가
**결정**: Designer를 Planner에 합병 (6에이전트 → 5에이전트)
**변경 내역**:
- `.claude/agents/planner/SKILL.md`: UI 설계 규칙, 컴포넌트 설계 형식, 상태 매핑 규칙 흡수
- `.claude/agents/designer/`: 폴더 삭제
- `docs/agents/pipeline.md`: Phase 3 "PLANNER + DESIGNER" → "PLANNER"
- `docs/agents/designer.md`: ARCHIVED 표시
**영향**: Critic, FE_DEV, BE_DEV, QA는 변경 없음 (Designer와 직접 상호작용 없었음)

## [DEC-007] 2026-03-08 — QA 3단계 검증: 코드 + 시각적 + 수용 테스트

**배경**: Sprint-001 실행 후 워크플로우 평가 결과, QA가 코드만 읽고 실제 브라우저를 보지 않는 구조적 결함 발견
**문제점**:
1. QA가 "코드에 버튼이 있다"를 확인하지만, 실제 브라우저에서 버튼이 보이는지는 확인 안 함
2. 빈 화면, 레이아웃 깨짐 같은 시각적 문제를 잡을 수 없음
3. "유저가 목표를 달성할 수 있는가"가 아닌 "코드가 존재하는가"만 검증
4. MetaGPT, Anthropic 연구 모두 최종 결과물 검증(E2E)을 권장
**조사**:
- MetaGPT: QA 에이전트가 코드 실행까지 수행 → 100% task completion
- Anthropic "Building Effective Agents": Evaluator-Optimizer 패턴에서 실제 결과 평가 강조
- Applitools/TestSprite: AI 기반 시각적 테스트 도구가 업계 표준화 추세
- OWM 환경: Playwright MCP, Chrome DevTools MCP, Claude Preview MCP 모두 사용 가능
**결정**: QA를 3단계로 확장
1. **Phase 5: 코드 검증** (기존) — 빌드/타입/요소 존재
2. **Phase 5c: 시각적 검증** (신규) — dev 서버 → 브라우저 → 렌더링 확인
3. **Phase 5d: 수용 테스트** (신규) — 유저 시나리오 클릭스루 → 목표 달성 확인
**변경 내역**:
- `.claude/agents/qa/SKILL.md`: 3단계 검증 체계 + 리포트 형식 확장
- `.claude/agents/planner/SKILL.md`: 수용 기준(Acceptance Criteria) 작성 규칙 + 화면별 기대 상태 규칙 추가
- `docs/agents/pipeline.md`: Phase 5c/5d/5e 추가 + completedPhases 명명 + 재시도 규칙 확장
- `.claude/commands/sprint.md`: QA 3단계 실행 절차 추가
**영향**: PLANNER가 수용 기준/화면 기대를 추가 작성, QA가 dev 서버 + 브라우저 검증 수행

## [DEC-008] 2026-03-08 — 프롬프트 수준 → 구조적 수준 전환: 오케스트레이터 강제 게이트

**배경**: NeurIPS 2025 "Why Do Multi-Agent LLM Systems Fail?" MAST 분류 체계와 EvoMAC(ICLR 2025), Anthropic "Building Effective Agents", OpenHands, Agentless 등의 연구를 심층 조사한 결과, 기존 파이프라인에 4가지 구조적 결함이 있음을 확인
**조사 결과**:
- FM-3.2 (불완전 검증, 15% — 가장 빈번한 실패 원인): DEC-007로 일부 해결
- FM-2.3 (작업 이탈, 12%): 에이전트가 요청받지 않은 파일을 수정하는 범위 이탈 감지 메커니즘 없음
- "Locally correct, globally destructive": 새 기능이 기존 기능을 깨뜨리는지 확인하는 회귀 테스트 없음
- **"Improved prompts yielded only +14%"**: SKILL.md 텍스트 개선만으로는 불충분, 구조적 변경 필요
- EvoMAC 텍스트 역전파: FAIL 시 "무엇이 실패"가 아닌 "왜 실패"를 전달해야 수정 정확도 향상

**핵심 통찰 — 프롬프트 수준 vs 구조적 수준**:
- **프롬프트 수준**: 에이전트 SKILL.md에 "확인하세요" 체크리스트 → 에이전트가 스킵/생략 가능 → 효과 ~14%
- **구조적 수준**: 오케스트레이터가 직접 Bash/Grep 실행 → 에이전트가 우회 불가
- **자기 비판**: 최초 구현 시 4가지 개선을 모두 SKILL.md 체크리스트(프롬프트 수준)로 구현했으나, 연구 결과 자체가 "프롬프트 개선은 +14%에 불과"라고 경고한 것을 간과
- **전환**: 모든 품질 게이트를 에이전트 자기검증(프롬프트)에서 오케스트레이터 강제 실행(구조적)으로 전환

**결정**: 4가지 구조적 개선을 **오케스트레이터 강제 게이트**로 적용
1. **오케스트레이터 강제 게이트** — 에이전트 자기검증이 아닌 오케스트레이터가 Bash/Grep으로 직접 실행
2. **위조 불가 범위 검증** — `git diff main...HEAD --name-only`로 실제 변경 파일 감지 (에이전트 보고서 아님)
3. **근본 원인 기반 피드백 경로** — FAIL 시 항상 DEV로 돌리지 않고, 원인에 따라 DEV/PLANNER/오케스트레이터 분기
4. **회귀 방지** — 오케스트레이터가 전체 빌드+타입체크를 직접 실행하여 기존 기능 파괴 감지

**에이전트 SKILL.md 변경 — "게이트" → "권장"으로 다운그레이드**:
- 각 에이전트의 "자기 검증 게이트 (필수)" → "자기 점검 (권장 — 오케스트레이터가 별도로 강제 게이트 실행)"
- 체크리스트 축소 (오케스트레이터가 검증하는 항목은 에이전트에서 제거)
- 오케스트레이터 강제 게이트 존재를 에이전트에 고지 (재시도 비용 줄이도록 유도)

**변경 내역**:
- `docs/agents/pipeline.md`: 프롬프트→구조적 수준 전면 교체, 🔒 오케스트레이터 강제 게이트(Phase 1g/2a/3g/4g), 근본 원인 기반 피드백 경로 테이블
- `.claude/commands/sprint.md`: 오케스트레이터 강제 게이트에 구체적 Bash 명령 추가 (Phase 1~5 후 각각)
- `.claude/agents/planner/SKILL.md`: "자기 검증 게이트 (필수)" → "자기 점검 (권장)"
- `.claude/agents/critic/SKILL.md`: "자기 검증 게이트 (필수)" → "자기 점검 (권장)"
- `.claude/agents/frontend-dev/SKILL.md`: "자기 검증 게이트 (필수)" → "자기 점검 (권장)", 체크리스트 8→3개 축소
- `.claude/agents/backend-dev/SKILL.md`: "자기 검증 게이트 (필수)" → "자기 점검 (권장)", 체크리스트 7→3개 축소
- `.claude/agents/qa/SKILL.md`: "자기 검증 게이트" → "재확인 규칙 (권장)", 회귀 테스트 + 근본 원인 분석 유지
- `CLAUDE.md`: 오케스트레이터 강제 게이트에 구체적 Bash 명령 + 피드백 경로 테이블 추가

**영향**: 품질 검증의 책임이 에이전트(프롬프트)에서 오케스트레이터(구조적)로 이동. 에이전트는 자기 점검 권장, 실제 합격/불합격은 오케스트레이터가 결정.

## [DEC-009] 2026-03-08 — 3계층 검증 아키텍처: Claude Code Hooks로 결정론적 강제

**배경**: DEC-008에서 오케스트레이터 강제 게이트(구조적 수준)로 전환했으나, 오케스트레이터 자체도 LLM이므로 프롬프트를 건너뛸 수 있음을 확인. "구조적 수준"이라 했지만 실제로는 "LLM에게 도구를 실행하라고 시키는 것"에 불과 — 여전히 프롬프트 수준의 한계가 있음.
**문제점**:
1. 오케스트레이터가 `npm run build`를 실행하라는 지시를 받지만, 건너뛰어도 시스템이 막지 않음
2. `.state.json`에 게이트 통과 기록이 없으면 건너뛴 것인지 아직 안 한 것인지 구분 불가
3. 프로세스 검증(빌드/타입)만 있고, 제품 검증("실제로 동작하는가")은 없음
4. DEC-008의 "구조적 수준"은 사실상 "더 강한 프롬프트" — 진짜 구조적 수준이 아님

**조사**:
- **Claude Code Hooks**: Claude의 생명주기 이벤트(Stop, PostToolUse, SessionStart 등)에 셸 명령을 바인딩. `exit 2` 반환 시 Claude의 해당 동작을 차단. LLM이 우회할 수 없는 런타임 강제.
- **Praetorian 39-에이전트 플랫폼**: Dirty Bit + Stop Hook + MANIFEST.yaml 패턴으로 품질 강제
- **AgentSpec (ICSE 2026)**: LLM 에이전트를 위한 런타임 제약 DSL — 정확히 이 문제를 다룸
- **Anthropic 공식 문서**: Stop hook에서 stdin으로 JSON 수신 (`stop_hook_active`, `cwd`, `session_id`), `exit 2`가 Claude 중단을 차단

**핵심 통찰 — 3계층 분류**:
- **Layer 1 (결정론적 강제)**: Claude Code Hooks — LLM이 우회 불가, 셸 exit code로 강제
- **Layer 2 (오케스트레이터 명령)**: PM이 Bash/Grep 직접 실행 — 반구조적, 건너뛸 가능성 있음
- **Layer 3 (LLM 판단)**: QA 에이전트의 시각적/행동 검증 — 비결정론적이지만 필수

**결정**: 3계층 검증 아키텍처 도입 + Layer 1 Stop 훅 구현
1. **Stop 훅** (`.claude/hooks/stop-gate.mjs`): 스프린트 중 TS/TSX 파일 변경 시, `npx tsc --noEmit` 통과 전까지 Claude가 멈출 수 없음
2. **게이트 자동 기록**: 훅이 `.state.json`의 `gates` 객체에 결과를 자동 기록 (tscExitCode, changedFiles, timestamps)
3. **안전 장치**: 훅 자체 에러 시에는 Claude를 차단하지 않음 (`exit 0`), 무한 루프 방지 (`stop_hook_active` 체크)

**구현 내역**:
- `.claude/hooks/stop-gate.mjs`: Node.js 기반 Stop 훅 (Windows/Linux 호환)
- `.claude/settings.json`: `hooks.Stop` 배열에 훅 명령 등록
- `docs/agents/pipeline.md`: 3계층 아키텍처 설명 + 원칙 1 업데이트
- `.claude/commands/sprint.md`: Layer 1 설명 + Phase 4 tsc 중복 실행 제거 + 게이트 기록 형식
- `CLAUDE.md`: 3계층 아키텍처 설명 + Layer 1 참조

**미구현 (향후 고려)**:
- `PostToolUse` 훅: Edit/Write 감지 → Dirty Bit 설정 (Praetorian 패턴)
- `SessionStart` 훅: 스프린트 상태 무결성 검증
- Smoke 테스트 스크립트: dev 서버 + curl HTTP 200 + 페이지 크기 임계값 (결정론적 제품 검증)
- Best-of-N 패턴: git worktree 기반 병렬 후보 생성 (비용 대비 효과 분석 필요)

**영향**: 타입 안전성 강제가 프롬프트 수준(에이전트 자기검증) → 구조적 수준(오케스트레이터 명령) → **결정론적 수준(런타임 훅)**으로 3단계 진화. Phase 4에서 타입 에러가 있으면 FE_DEV가 물리적으로 완료를 보고할 수 없음.
