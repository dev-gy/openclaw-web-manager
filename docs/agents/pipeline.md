# 스프린트 파이프라인

## 개요
자율 운영 멀티 에이전트 파이프라인. 사람 개입 없이 유저분석→기획→비평→설계→구현→검증을 수행한다.

## 핵심 설계 원칙 (연구 기반)

> 출처: NeurIPS 2025 "Why Do Multi-Agent LLM Systems Fail?", EvoMAC (ICLR 2025), Anthropic "Building Effective Agents", OpenHands SOTA, Agentless

### 3계층 검증 아키텍처

```
Layer 1: 결정론적 강제 (Claude Code Hooks — LLM 우회 불가)
  └ Stop 훅: .claude/hooks/stop-gate.mjs
  └ 스프린트 중 코드 변경 → tsc --noEmit 통과 전까지 Claude가 멈출 수 없음
  └ exit 2 → Claude 계속 작업 강제
  └ 게이트 결과를 .state.json에 자동 기록

Layer 2: 오케스트레이터 강제 게이트 (PM이 Bash/Grep 직접 실행)
  └ Phase 간 품질 게이트 (1g, 2a, 3g, 4g, 5a)
  └ npm run build, git diff --name-only, 범위 검증 등
  └ 에이전트 자기평가가 아닌 오케스트레이터 직접 실행

Layer 3: LLM 기반 검증 (QA 에이전트 — Layer 1-2 통과 후에만)
  └ Phase 5c: 시각적 검증 (브라우저 스크린샷)
  └ Phase 5d: 수용 테스트 (유저 시나리오 클릭스루)
  └ 주관적 판단이 필요한 검증만 LLM에 맡김
```

**Layer 구분 기준**:
- **Layer 1**: LLM이 우회 불가능 (Hook 메커니즘 = 런타임 강제)
- **Layer 2**: LLM이 이론적으로 스킵 가능하지만 sprint.md가 명시적으로 지시 (오케스트레이터 레벨)
- **Layer 3**: LLM 판단에 의존 (시각적/행동적 검증은 기계적 자동화 불가)

> 참고: Praetorian 39-에이전트 플랫폼, AgentSpec (ICSE 2026)에서 동일한 패턴 사용

### 5대 원칙
1. **결정론적 강제 (Hook)**: `tsc --noEmit` 실패 시 Claude가 멈출 수 없음 — `.claude/hooks/stop-gate.mjs`
2. **위조 불가 범위 검증**: 변경 파일 감지는 에이전트 보고가 아닌 **`git diff --name-only`**로 한다
3. **근본 원인 기반 피드백 경로**: FAIL 시 항상 DEV에게 돌리는 게 아닌 **원인에 따라 DEV/PLANNER 분기**한다
4. **회귀 방지**: 오케스트레이터가 **전체 빌드+타입체크를 직접 실행**하여 기존 기능 파괴를 감지한다
5. **모호성 금지**: 스펙의 모호한 표현은 구현 단계에서 발산을 일으킨다. 구체적 수치로 명세한다

## 에이전트 목록
| 코드명 | 역할 | 프로필 | subagent_type |
|--------|------|--------|---------------|
| PLANNER | 기획자 겸 UI 아키텍트 | `.claude/agents/planner/SKILL.md` | planner |
| CRITIC | 비평가 | `.claude/agents/critic/SKILL.md` | critic |
| FE_DEV | 프론트 개발자 | `.claude/agents/frontend-dev/SKILL.md` | frontend-dev |
| BE_DEV | 백엔드 개발자 | `.claude/agents/backend-dev/SKILL.md` | backend-dev |
| QA | QA 엔지니어 | `.claude/agents/qa/SKILL.md` | qa |

> **변경 이력**: Sprint-001 이후 DESIGNER를 PLANNER에 합병 (DEC-006).
> Phase 3에서 PLANNER가 UI 설계까지 통합 수행.

## 파이프라인 흐름

```
Phase 1: 유저 분석 → 기획 → UX 스케치 (PLANNER)
│ Input: 스프린트 주제
│ Step 1: 유저 분석 — 현재 유저 경험과 문제점 파악 (제품 상태 직접 확인)
│ Step 2: 아이디어 도출 — 유저 문제에서 기능/디자인 아이디어 도출
│ Step 3: 기능 정의 + UX 스케치 — 유저 플로우, 와이어프레임
│ Output: 00-plan.md (유저 분석 + 기획), 01-spec.md (기능 스펙 + UX 스케치)
│
┌─ Phase 1g: 오케스트레이터 강제 게이트 (PLANNER 산출물)
│ 오케스트레이터가 직접 실행:
│   Grep "적절한|필요에 따라|등" 01-spec.md → 모호 표현 감지
│   Grep "빈 상태|에러 상태|로딩" 01-spec.md → 3가지 상태 정의 확인
│ FAIL 시: 모호 표현 목록을 PLANNER에게 전달 → Phase 1 재실행
└─
│
Phase 2: 비평 (CRITIC)
│ Input: 01-spec.md (기획 과정은 전달하지 않음!)
│ Output: 02-review.md (각 지적에 [근거:] 태그 필수)
│
┌─ Phase 2a: 오케스트레이터 강제 게이트 (CRITIC 산출물)
│ 오케스트레이터가 직접 실행:
│   Grep "\[근거:" 02-review.md → 근거 태그 비율 확인
│   Grep "심각도.*높음" 02-review.md → "높음" 지적 추출
│   "높음" 지적 중 [근거:] 없는 항목 → Grep/WebSearch로 직접 검증
│ 틀린 지적 제거 후 Phase 3에 전달
└─
│
Phase 3: 스펙 수정 + UI 설계 (PLANNER)
│ Input: 01-spec.md + 02-review.md
│ Output: 03-spec-revised.md (비평 반영 + UI 설계 통합)
│   - 컴포넌트 트리 구조
│   - 상태별 화면 설명 (ASCII 와이어프레임)
│   - 애니메이션/전환 효과 명세
│   - Tailwind 클래스 지침
│   - 검증 체크리스트 (최종)
│   - 화면별 기대 상태 + 수용 기준
│
┌─ Phase 3g: 오케스트레이터 강제 게이트 (수정 스펙 산출물)
│ 오케스트레이터가 직접 실행:
│   02-review.md의 각 CRIT 항목 ID를 03-spec-revised.md에서 Grep → 반영 누락 감지
│   Grep "적절한|필요에 따라|등" 03-spec-revised.md → 모호 표현 잔존 확인
│ FAIL 시: 누락 항목 목록을 PLANNER에게 전달 → Phase 3 재실행
└─
│
Phase 4: 구현 (FE_DEV / BE_DEV)
│ Input: 03-spec-revised.md
│ Output: 코드 변경 + 04-implementation.md
│
┌─ Phase 4g: 오케스트레이터 강제 게이트 2종 (구현 산출물)
│ (참고: tsc --noEmit은 Layer 1 Stop 훅이 자동 강제 — 별도 실행 불필요)
│
│ [게이트 A: 빌드+회귀 검증] — 오케스트레이터가 직접 실행
│   Bash: npm run build
│   (npm run build는 전체 프로젝트를 빌드하므로, 회귀 검증을 겸한다)
│   exit code ≠ 0 → FE_DEV에게 에러 메시지 전달 → Phase 4 재실행
│
│ [게이트 B: 범위 검증] — git diff로 위조 불가
│   Bash: git diff main...HEAD --name-only
│   실제 변경 파일 vs 03-spec-revised.md 언급 파일 비교
│   분류:
│     - types/ utils/ 라우트 등록 → 허용 (연쇄 수정)
│     - components/ui/ → 경고 (회귀 위험, 오케스트레이터가 변경 내용 확인)
│     - 스펙 무관 파일 → 위반 → FE_DEV에게 git checkout 지시
│
└─ 2종 게이트 모두 PASS 시 Phase 5로 진행
│
Phase 5: 코드 검증 (QA)
│ Input: 03-spec-revised.md의 체크리스트 (구현 코드는 안 봄)
│ Tool: Bash (빌드/타입체크), Read/Grep (코드 검증)
│ Output: 05-qa-report.md (코드 레벨)
│
┌─ Phase 5a: 오케스트레이터 강제 게이트 (QA 산출물)
│ 05-qa-report.md의 FAIL 항목 검증:
│   FAIL에 [측정값]이 있는지 확인 → 없으면 오케스트레이터가 직접 Grep으로 재검증
│   FAIL에 [근본 원인]이 있는지 확인 → 없으면 QA에게 분석 보완 요청
│ 오판이면 수정 후 최종 판정
└─
│
Phase 5b: 코드 실패 시 → 피드백 경로 분기 (최대 2회)
│ 오케스트레이터가 근본 원인을 분류:
│   원인 = 구현 버그 → FE_DEV에게 전달 → Phase 4 재실행
│   원인 = 스펙 모호/누락 → PLANNER에게 전달 → Phase 3 재실행 → Phase 4 재실행
│   원인 = 환경/설정 → 오케스트레이터가 직접 해결
│ 전달 정보: FAIL 항목 + 측정값 + 근본 원인 + 수정 범위
│
Phase 5c: 시각적 검증 (QA)
│ Input: 03-spec-revised.md의 화면별 기대 상태
│ Tool: dev 서버 실행 → 스크린샷/스냅샷 → 레이아웃 확인
│ 검증 항목:
│   - 빈 화면이 아닌가 (콘텐츠가 실제 렌더링되는가)
│   - 레이아웃이 깨지지 않았는가 (요소 겹침, 넘침 없는가)
│   - 주요 UI 요소가 보이는가 (버튼, 텍스트, 아이콘)
│   - 스펙의 상태별 화면이 의도대로 표시되는가
│   - [회귀] 변경 대상 아닌 기존 페이지 1개 이상 스크린샷 확인
│ Output: 05-qa-report.md에 시각적 검증 섹션 추가
│
Phase 5d: 수용 테스트 (QA)
│ Input: 03-spec-revised.md의 수용 기준 (유저 시나리오)
│ Tool: 브라우저에서 유저 플로우 재현 (클릭, 입력, 네비게이션)
│ 검증 항목:
│   - 유저가 목표를 달성할 수 있는가 (시나리오대로 동작하는가)
│   - 에러 상태에서 복구 경로가 있는가
│   - 피드백이 유저에게 전달되는가 (로딩, 성공, 실패)
│ Output: 05-qa-report.md에 수용 테스트 섹션 추가
│
Phase 5e: 시각적/수용 실패 시 → 피드백 경로 분기 (최대 2회)
│ 오케스트레이터가 근본 원인을 분류:
│   원인 = 구현 버그 → FE_DEV에게 실패 항목 + 스크린샷 + 근본 원인 전달 → Phase 4 재실행
│   원인 = 스펙 모호/누락 → PLANNER에게 전달 → Phase 3 → 4 재실행
│   원인 = 환경/설정 → 오케스트레이터가 직접 해결
│
Phase 6: 마무리 (PM/오케스트레이터)
│ Output: 06-summary.md
│ decisions.md 업데이트
```

## 컨텍스트 분리 규칙 (검증 신뢰도)

| 에이전트 | 읽는 것 | 읽지 않는 것 | 이유 |
|---------|---------|-------------|------|
| PLANNER (Phase 1) | 스프린트 주제, 참조 파일 | — | 백지에서 기획 |
| CRITIC | 01-spec.md만 | 00-plan.md (기획 의도) | 의도를 모르고 스펙만 평가해야 독립적 |
| PLANNER (Phase 3) | 01-spec.md + 02-review.md | 00-plan.md | 비평 반영에 집중 |
| FE_DEV | 03-spec-revised.md + 기존 코드베이스 | 02-review.md (왜 이렇게 바뀌었는지) | 스펙만 보고 구현해야 독립 검증 가능 |
| BE_DEV | 03-spec-revised.md + 기존 서버 코드 | 02-review.md | 동일 |
| QA (코드) | 03-spec-revised.md 체크리스트만 | 04-implementation.md (어떻게 구현했는지) | 구현 방법을 모르고 결과만 검증 |
| QA (시각적) | 03-spec-revised.md 화면 기대 상태 + 브라우저 실제 상태 | 구현 코드 | 눈에 보이는 결과만 검증 |
| QA (수용) | 03-spec-revised.md 수용 기준 + 브라우저 유저 플로우 | 구현 의도 | 유저 시나리오 달성 여부만 검증 |

> **핵심**: 이전 단계의 "의도"를 전달하지 않아야 독립적 검증이 가능하다.

## 재시도 규칙

### 근본 원인 피드백 형식 (FAIL → 재시도 시 필수)
QA가 FAIL 판정 시, 단순히 "무엇이 실패했는가"가 아닌 **"왜 실패했는가"**를 구조화하여 전달한다:
```
### [FAIL-001] 실패 항목
- 증상: 무엇이 안 되는가 (현상)
- 근본 원인: 왜 안 되는가 (코드/구조적 원인)
- 영향 범위: 이 실패가 다른 기능에도 영향을 주는가
- 수정 제안: 어떻게 고쳐야 하는가 (파일명, 라인, 방향)
```

### 피드백 경로 분기 (오케스트레이터가 판단)

FAIL 시 "항상 DEV에게 돌리기"가 아닌, **근본 원인에 따라 어디로 돌릴지** 오케스트레이터가 분류한다:

| 근본 원인 | 되돌릴 단계 | 예시 |
|----------|-----------|------|
| 구현 버그 | Phase 4 (FE_DEV) | 빌드 에러, 로직 오류, 누락된 분기 |
| 스펙 모호/누락 | Phase 3 (PLANNER) → Phase 4 | "빈 상태"를 정의했지만 CTA 텍스트 미명시 |
| 환경/설정 | 오케스트레이터 직접 해결 | dev 서버 포트 충돌, 의존성 미설치 |
| 요구사항 부재 | 스프린트 중단 → 유저 확인 | 기획에 없는 기능을 QA가 기대 |

### 재시도 절차
- **구현 버그**: 근본 원인 + 실패 항목을 FE_DEV에게 전달 → Phase 4 재실행 → 해당 QA 재실행
- **스펙 문제**: 모호/누락 항목을 PLANNER에게 전달 → Phase 3 재실행 → Phase 4 재실행 → QA 재실행
- 최대 재시도: 각 단계별 2회 — `.state.json`의 `retries` 객체로 추적
  - `retries.phase4`: Phase 4 구현 재시도 (최대 2)
  - `retries.phase5`: Phase 5 코드 QA 재시도 (최대 2)
  - `retries.phase5cd`: Phase 5c/5d 시각적+수용 재시도 (최대 2)
- 재시도 소진 후에도 FAIL이면: 06-summary.md에 미해결 항목 + 근본 원인 분석 기록 → 다음 스프린트로 이월

## 상태 추적 (.state.json)

각 스프린트 폴더에 `.state.json`을 두고 Phase마다 업데이트:
```json
{
  "topic": "스프린트 주제",
  "status": "running | completed | failed",
  "currentPhase": 1,
  "retries": { "phase4": 0, "phase5": 0, "phase5cd": 0 },
  "completedPhases": [1, "1g", 2, "2a", 3, "3g", 4, "4g", 5, "5a", "5c", "5d", 6],
  "startedAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### completedPhases 명명 규칙
| Phase 값 | 의미 |
|----------|------|
| `1` | Phase 1 유저 분석 + 기획 + UX 스케치 완료 |
| `"1g"` | Phase 1g 스펙 품질 게이트 통과 |
| `2` | Phase 2 비평 완료 |
| `"2a"` | Phase 2a 비평 품질 게이트 통과 |
| `3` | Phase 3 스펙 수정 + UI 설계 완료 |
| `"3g"` | Phase 3g 수정 스펙 반영 게이트 통과 |
| `4` | Phase 4 구현 완료 (분할 실행 시 `"4-a"`, `"4-b"`, `"4-c"` 등) |
| `"4g"` | Phase 4g 구현 품질 게이트 통과 (빌드+범위) |
| `5` | Phase 5 코드 QA 완료 |
| `"5a"` | Phase 5a QA 산출물 게이트 통과 |
| `"5b-fix"` | Phase 5b 코드 수정 완료 |
| `"5-retry"` | Phase 5 코드 재시도 QA 완료 |
| `"5c"` | Phase 5c 시각적 검증 완료 |
| `"5d"` | Phase 5d 수용 테스트 완료 |
| `"5e-fix"` | Phase 5e 시각적/수용 수정 완료 |
| `"5cd-retry"` | Phase 5c/5d 재시도 완료 |
| `6` | Phase 6 마무리 완료 |

> **분할 실행**: Phase 4에서 스펙이 500줄 초과로 분할 실행 시 `"4-a"`, `"4-b"` 등으로 기록 (Phase 4g 게이트와 구분).
> **재시도**: Phase 5 FAIL 후 재시도 시 `"5b-fix"` (수정), `"5-retry"` (재검증)으로 기록.

**오토컴팩트 복구**: 컨텍스트가 압축되면 `.state.json`을 읽어 현재 Phase부터 재개.

## 대규모 스펙 분할 (Phase 4)

03-spec-revised.md가 500줄 초과 시:
1. 스펙을 독립 구현 가능한 단위(컴포넌트/페이지)로 분류
2. 각 단위를 별도 Task로 실행 (해당 섹션 + 공통 규칙만 전달)
3. 전체 완료 후 `npm run build`로 통합 확인

## 스프린트 실행 명령
```
PM(메인 세션)이 순서대로 Task를 실행:
(각 Phase 완료마다 .state.json 업데이트)
(🔒 = 오케스트레이터 강제 게이트 — 에이전트가 아닌 PM이 직접 실행)

1.  Task(planner): .claude/agents/planner/SKILL.md 역할 + 주제
🔒  PM이 01-spec.md에서 모호 표현 Grep + 빈/에러/로딩 상태 존재 확인 → FAIL 시 재실행
2.  Task(critic): .claude/agents/critic/SKILL.md 역할 + 01-spec.md
🔒  PM이 02-review.md에서 [근거:] 태그 비율 확인 + "높음" 지적 재검증 → 틀리면 제거
3.  Task(planner): 수정 프롬프트 + 01-spec.md + 검증된 02-review.md
🔒  PM이 03-spec-revised.md에서 CRIT 항목 반영 확인 + 모호 표현 잔존 확인
4.  Task(fe_dev / be_dev): 03-spec-revised.md (500줄 초과 시 분할 실행)
🔒  PM이 직접 2종 게이트 실행 (tsc --noEmit은 Layer 1 Stop 훅이 자동 강제):
    A. Bash: npm run build (빌드+회귀 — 전체 프로젝트 빌드)
    B. Bash: git diff main...HEAD --name-only → 스펙 vs 실제 변경 비교 (범위)
5.  Task(qa): 코드 검증 — 빌드/타입체크/요소 존재
🔒  PM이 FAIL 항목에 측정값 + 근본 원인 있는지 확인 → 없으면 QA에 보완 요청
5b. FAIL 시 → PM이 근본 원인 분류 → DEV/PLANNER 분기 → 해당 Phase 재실행 (최대 2회)
5c. Task(qa): 시각적 검증 — dev 서버 → 스크린샷 → 레이아웃/렌더링 + 회귀 확인
5d. Task(qa): 수용 테스트 — 유저 시나리오 클릭스루 → 목표 달성 확인
5e. FAIL 시 → PM이 근본 원인 분류 → DEV/PLANNER 분기 → 해당 Phase 재실행 (최대 2회)
6.  summary 작성 + .state.json status → "completed"
```
