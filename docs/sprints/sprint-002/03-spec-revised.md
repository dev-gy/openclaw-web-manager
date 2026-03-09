# Sprint-002: 03-spec-revised.md -- 수정 스펙 (상세 UI 설계)

---

## CRIT 반영 요약

| CRIT | 심각도 | 지적 요약 | 반영 방법 |
|------|--------|-----------|-----------|
| CRIT-001 | 높음 | 활동 로그 데이터 소스 미정의 | `useAgentActivity` 훅에 `activityLogs` 배열 추가, `ActivityLogEntry` 타입 정의, `onMessage` 내부 로그 push 로직 명시 (Section A F-006 수정) |
| CRIT-002 | 높음 | SVG+HTML 좌표 동기화 미정의 | SVG를 순수 배경 장식으로 제한, 모든 배치를 CSS `%` 단위 + `position: absolute`로 통일. SVG viewBox는 고정 `0 0 1000 500` (Section A F-001 수정) |
| CRIT-003 | 높음 | 가구 SVG 14종 형태 미정의 | 가구별 viewBox, 치수(width x height), SVG path data를 표로 명시 (Section A F-002 수정, 별도 부록 B-FURNITURE) |
| CRIT-004 | 중간 | seedToColors private | `seedToColors`를 `lib/utils.ts`로 이동하고 export. `AgentAvatar.tsx`는 `lib/utils`에서 import (Section A F-006 수정) |
| CRIT-005 | 중간 | ChevronDown/Up 아이콘 부재 | 기존 프로젝트 패턴(인라인 SVG)에 맞춰 인라인 `<svg>` 태그로 구현. 구체적 path data 명시 (Section A F-006 수정) |
| CRIT-006 | 중간 | 존 이동 애니메이션 미정의 | CSS `transition: left 400ms ease-out, bottom 400ms ease-out`으로 슬라이딩 이동. 에이전트 wrapper에 transition 적용 (Section A F-003 수정) |
| CRIT-007 | 중간 | 사이드 패널 320px + 오피스 min-width 800px 충돌 | 오버레이 모달 전환 기준을 "콘텐츠 영역 폭 < 1120px (800+320)"으로 변경. CSS 미디어쿼리 `@media (max-width: 1359px)` 적용 (사이드바 240px 고려) (Section A F-010 수정) |
| CRIT-008 | 중간 | "+N" 뱃지 클릭 인터랙션 미정의 | 클릭 시 Tooltip 컴포넌트로 숨겨진 에이전트 이름 목록 표시. 목록 내 에이전트 클릭 시 사이드 패널 열림 (Section A F-003 수정) |
| CRIT-009 | 낮음 | Zzz 부유 애니메이션 모호 | 기존 `animate-float` 클래스(float-y keyframe) 적용 명시. "Zzz" 텍스트에 `animate-float` + `opacity: 0.6` (Section A F-004 수정) |
| CRIT-010 | 낮음 | 가구 SVG 14종 DOM 성능 | 가구 컴포넌트를 `React.memo`로 래핑. 존별 가구를 단일 SVG 내 `<g>` 그룹으로 통합하여 DOM 노드 최소화 (Section B 컴포넌트 설계) |
| CRIT-011 | 낮음 | 에러 재시도 vs 헤더 새로고침 중복 | 에러 배너 "재시도" = `refresh()` + `setError(null)` (에러 상태 초기화). 헤더 "새로고침" = `refresh()` (에러 배너 유지). 에러 배너에 "또는 상단 새로고침 버튼을 사용하세요" 부가 텍스트 제거, 재시도 버튼만 표시 (Section A F-007 수정) |

---

## Section A: 기능 요구사항 (수정)

### F-001: 싱글 플로어 오피스 컨테이너 (CRIT-002 반영)

**유저 문제 해결**: 5개 grid 카드로 분리된 존을 하나의 연속 공간으로 통합하여, "한 오피스의 여러 구역"으로 인지하게 한다.

**좌표 전략** (CRIT-002 해결):
- SVG는 **순수 배경 장식만** 담당: 바닥선, 벽면, 존 구분선, 존 라벨 배경
- SVG viewBox: 고정 `0 0 1000 500`. `preserveAspectRatio="none"`으로 컨테이너 크기에 맞춤
- 가구와 에이전트는 모두 **HTML `position: absolute`**로 배치
- 바닥선 y좌표: **CSS `bottom: 20%`** (컨테이너 높이의 80% 지점)
- 에이전트/가구의 `bottom` 값: `20%` 기준으로 계산 (바닥선 위에 올라감)
- 모든 가로 좌표는 **퍼센트(`%`) 단위**를 사용하여 컨테이너 폭에 비례
- SVG와 HTML 좌표계 동기화 불필요 (각각 독립적으로 `%` 기반 배치)

**상세**:
- 기존 `grid grid-cols-1 lg:grid-cols-3 gap-4`를 제거하고, 1개의 `position: relative` 컨테이너로 대체
- 컨테이너 내부 레이어 구조 (z-index 순서):
  1. z-0: 배경 SVG (바닥선, 벽면, 존 구분선)
  2. z-10: 가구 HTML 요소 (position: absolute, pointer-events: none)
  3. z-20: 에이전트 HTML 요소 (position: absolute)
  4. z-30: 말풍선 HTML 요소 (position: absolute)
  5. z-40: 빈 오피스 안내 패널 (조건부)
- 배경 SVG 구성 (viewBox `0 0 1000 500`):
  - 벽면: `<rect x="0" y="0" width="1000" height="400" fill="var(--owm-bg-secondary)" />`
  - 바닥: `<rect x="0" y="400" width="1000" height="100" fill="var(--owm-bg-primary)" opacity="0.5" />`
  - 바닥선: `<line x1="0" y1="400" x2="1000" y2="400" stroke="var(--owm-border)" stroke-width="2" />`
  - 존 구분선 4개: x=120, x=300, x=620, x=800 위치에 `<line>` (stroke-dasharray="4 4", 높이 y1=100 y2=400)
- 5개 존의 가로 범위 (퍼센트):
  - entrance: 0%~12%
  - lounge: 12%~30%
  - desk: 30%~62%
  - meeting: 62%~80%
  - bookshelf: 80%~100%
- 컨테이너 CSS:
  - `position: relative`
  - `min-height: 420px`, `max-height: 520px`, `height: 50vh`
  - `width: 100%`, `min-width: 800px`
  - `overflow: hidden` (내부 요소 잘림 방지는 z-30 말풍선만 `overflow: visible` 별도 처리)
  - `border-radius: 12px`, `border: 1px solid var(--owm-border)`
- 1024px 미만 화면: 부모에 `overflow-x: auto` 적용하여 가로 스크롤

**입출력**:
- 입력: `agents: AgentActivity[]` (useAgentActivity 훅에서)
- 출력: SVG 배경 + HTML absolute 레이아웃

### F-002: 존별 가구 SVG 세트 (CRIT-003 반영)

**유저 문제 해결**: 빈 존에도 가구가 보여 "게임 오피스" 느낌을 유지한다.

**가구 배치 좌표 (HTML absolute, % 단위)** (CRIT-003 해결):

모든 가구는 `position: absolute` HTML 요소 내 인라인 SVG로 렌더링한다. 좌표는 오피스 컨테이너 기준 퍼센트이다.

**가구 공통 스타일**:
- `stroke`: `var(--owm-text-secondary)`, `opacity: 0.5`
- `stroke-width`: 1.5
- `fill`: `var(--owm-bg-card)`, `opacity: 0.3`
- `pointer-events: none`
- 각 가구 SVG는 `React.memo`로 감싼다 (CRIT-010 반영)

**가구 치수 + 배치표**:

| # | 가구 | viewBox | 표시 크기 (px) | 위치 (left%, bottom%) | 설명 |
|---|------|---------|---------------|----------------------|------|
| 1 | 문 (열린 상태) | 0 0 30 60 | 30x60 | left: 1%, bottom: 20% | 존 왼쪽 끝, 바닥선 위 |
| 2 | 우산꽂이 | 0 0 12 28 | 12x28 | left: 5%, bottom: 20% | 문 오른쪽 |
| 3 | 소파 | 0 0 60 32 | 60x32 | left: 14%, bottom: 42% | 벽 쪽 (바닥선보다 위) |
| 4 | 커피 테이블 | 0 0 32 20 | 32x20 | left: 16%, bottom: 24% | 소파 앞, 바닥 가까이 |
| 5 | 화분 | 0 0 14 24 | 14x24 | left: 26%, bottom: 20% | 테이블 옆 |
| 6 | 책상+모니터 A | 0 0 48 40 | 48x40 | left: 33%, bottom: 28% | 왼쪽 책상세트 |
| 7 | 사무용 의자 A | 0 0 20 24 | 20x24 | left: 36%, bottom: 20% | 왼쪽 책상 앞 |
| 8 | 책상+모니터 B | 0 0 48 40 | 48x40 | left: 49%, bottom: 28% | 오른쪽 책상세트 |
| 9 | 사무용 의자 B | 0 0 20 24 | 20x24 | left: 52%, bottom: 20% | 오른쪽 책상 앞 |
| 10 | 화이트보드 | 0 0 40 48 | 40x48 | left: 64%, bottom: 40% | 벽 쪽 |
| 11 | 둥근 테이블 | 0 0 36 24 | 36x24 | left: 68%, bottom: 24% | 테이블 중앙 |
| 12 | 의자 3개 세트 | 0 0 50 18 | 50x18 | left: 66%, bottom: 20% | 테이블 앞 |
| 13 | 책장 A | 0 0 28 56 | 28x56 | left: 82%, bottom: 30% | 벽 쪽, 왼쪽 |
| 14 | 책장 B | 0 0 28 56 | 28x56 | left: 89%, bottom: 30% | 벽 쪽, 오른쪽 |
| 15 | 스텝 사다리 | 0 0 16 28 | 16x28 | left: 93%, bottom: 20% | 책장 앞 |

**가구 SVG path data** (부록 B-FURNITURE):

```
가구 #1: 문 (열린 상태) -- viewBox="0 0 30 60"
<rect x="2" y="0" width="4" height="60" rx="1" />         <!-- 문틀 왼쪽 -->
<rect x="2" y="0" width="26" height="3" rx="1" />          <!-- 문틀 상단 -->
<rect x="6" y="3" width="22" height="54" rx="1" />         <!-- 문짝 (살짝 열림) -->
<circle cx="10" cy="32" r="2" />                            <!-- 손잡이 -->

가구 #2: 우산꽂이 -- viewBox="0 0 12 28"
<rect x="2" y="8" width="8" height="20" rx="2" />          <!-- 통 -->
<line x1="4" y1="0" x2="4" y2="10" />                       <!-- 우산 1 -->
<line x1="8" y1="2" x2="8" y2="10" />                       <!-- 우산 2 -->

가구 #3: 소파 -- viewBox="0 0 60 32"
<rect x="0" y="8" width="60" height="24" rx="4" />         <!-- 좌석 -->
<rect x="0" y="0" width="8" height="32" rx="3" />          <!-- 팔걸이 왼 -->
<rect x="52" y="0" width="8" height="32" rx="3" />         <!-- 팔걸이 오 -->
<rect x="8" y="2" width="44" height="10" rx="3" />         <!-- 등받이 -->

가구 #4: 커피 테이블 -- viewBox="0 0 32 20"
<rect x="2" y="0" width="28" height="4" rx="1" />          <!-- 상판 -->
<rect x="4" y="4" width="3" height="16" rx="1" />          <!-- 다리 왼 -->
<rect x="25" y="4" width="3" height="16" rx="1" />         <!-- 다리 오 -->

가구 #5: 화분 -- viewBox="0 0 14 24"
<path d="M3 10 L1 24 L13 24 L11 10 Z" />                   <!-- 화분 -->
<circle cx="7" cy="6" r="5" />                               <!-- 잎사귀 (원) -->
<line x1="7" y1="10" x2="7" y2="11" />                      <!-- 줄기 -->

가구 #6/#8: 책상+모니터 -- viewBox="0 0 48 40"
<rect x="0" y="16" width="48" height="4" rx="1" />         <!-- 책상 상판 -->
<rect x="2" y="20" width="4" height="20" rx="1" />         <!-- 다리 왼 -->
<rect x="42" y="20" width="4" height="20" rx="1" />        <!-- 다리 오 -->
<rect x="14" y="2" width="20" height="14" rx="2" />        <!-- 모니터 화면 -->
<rect x="22" y="16" width="4" height="2" />                 <!-- 모니터 스탠드 -->

가구 #7/#9: 사무용 의자 -- viewBox="0 0 20 24"
<rect x="4" y="0" width="12" height="12" rx="2" />         <!-- 등받이 -->
<rect x="2" y="12" width="16" height="4" rx="1" />         <!-- 좌석 -->
<rect x="8" y="16" width="4" height="4" />                  <!-- 기둥 -->
<ellipse cx="10" cy="22" rx="8" ry="2" />                    <!-- 바퀴 베이스 -->

가구 #10: 화이트보드 -- viewBox="0 0 40 48"
<rect x="4" y="0" width="32" height="36" rx="2" />         <!-- 보드 -->
<rect x="6" y="2" width="28" height="30" rx="1" fill="white" opacity="0.1" /> <!-- 화면 -->
<rect x="16" y="36" width="3" height="12" />                <!-- 다리 왼 -->
<rect x="21" y="36" width="3" height="12" />                <!-- 다리 오 -->

가구 #11: 둥근 테이블 -- viewBox="0 0 36 24"
<ellipse cx="18" cy="4" rx="18" ry="4" />                    <!-- 상판 -->
<rect x="16" y="4" width="4" height="16" />                  <!-- 기둥 -->
<ellipse cx="18" cy="22" rx="10" ry="2" />                   <!-- 베이스 -->

가구 #12: 의자 3개 세트 -- viewBox="0 0 50 18"
<rect x="2" y="0" width="10" height="10" rx="2" />         <!-- 의자 1 -->
<rect x="0" y="10" width="14" height="3" rx="1" />
<rect x="20" y="0" width="10" height="10" rx="2" />        <!-- 의자 2 -->
<rect x="18" y="10" width="14" height="3" rx="1" />
<rect x="38" y="0" width="10" height="10" rx="2" />        <!-- 의자 3 -->
<rect x="36" y="10" width="14" height="3" rx="1" />

가구 #13/#14: 책장 -- viewBox="0 0 28 56"
<rect x="0" y="0" width="28" height="56" rx="2" />         <!-- 외곽 -->
<line x1="2" y1="14" x2="26" y2="14" />                     <!-- 선반 1 -->
<line x1="2" y1="28" x2="26" y2="28" />                     <!-- 선반 2 -->
<line x1="2" y1="42" x2="26" y2="42" />                     <!-- 선반 3 -->
<rect x="4" y="2" width="6" height="10" rx="1" />          <!-- 책 1 -->
<rect x="12" y="4" width="5" height="8" rx="1" />          <!-- 책 2 -->
<rect x="19" y="3" width="6" height="9" rx="1" />          <!-- 책 3 -->

가구 #15: 스텝 사다리 -- viewBox="0 0 16 28"
<line x1="2" y1="0" x2="4" y2="28" />                       <!-- 프레임 왼 -->
<line x1="14" y1="0" x2="12" y2="28" />                     <!-- 프레임 오 -->
<line x1="4" y1="8" x2="12" y2="8" />                       <!-- 발판 1 -->
<line x1="4" y1="16" x2="12" y2="16" />                     <!-- 발판 2 -->
<line x1="5" y1="24" x2="11" y2="24" />                     <!-- 발판 3 -->
```

### F-003: 에이전트 캐릭터 공간 배치 (CRIT-006, CRIT-008 반영)

**유저 문제 해결**: 에이전트가 오피스 바닥 위에 서있는 느낌을 준다.

**배치 규칙**:
- 에이전트는 `position: absolute` HTML 요소로, 컨테이너 기준 `left: N%`, `bottom: N%`로 배치
- 같은 존에 복수 에이전트: 존 내에서 좌로부터 `zoneStartPercent + index * 4%` 간격으로 배치
- 에이전트 최대 표시 수: 존당 6명. 7명 이상이면 "+N" 뱃지 표시
- 아바타 크기: `size="md"` (48px)
- 이름 라벨: font-size 10px, max-width 52px, truncate, text-center
- 클릭 시 `selectedAgent` 설정
- 선택된 에이전트: 캐릭터 아래에 `border-bottom: 2px solid var(--owm-accent)` + `bg-accent/10` 강조

**존별 에이전트 bottom 좌표**:
- entrance: bottom: 21% (바닥선 바로 위)
- lounge: bottom: 21%
- desk: bottom: 25% (의자에 앉아있는 느낌, 바닥선보다 약간 위)
- meeting: bottom: 21%
- bookshelf: bottom: 21%

**존별 에이전트 시작 left 좌표**:
- entrance: 3%
- lounge: 17%
- desk: 38% (가구 뒤쪽 빈 공간)
- meeting: 70%
- bookshelf: 85%

**존 이동 애니메이션** (CRIT-006 해결):
- 에이전트 wrapper 요소에 CSS transition 적용: `transition: left 400ms ease-out, bottom 400ms ease-out`
- 상태 변경으로 location이 바뀌면, left/bottom 값이 변경되며 자연스럽게 슬라이딩 이동
- key prop은 `agent.id` 고정 (React가 DOM 요소를 재사용하도록)

**"+N" 뱃지 인터랙션** (CRIT-008 해결):
- 존에 에이전트 7명 이상일 때 6번째 에이전트 위치 다음에 "+N" 뱃지 표시
- "+N" 뱃지 스타일: Badge 컴포넌트 variant="neutral" size="sm", 48px 높이 영역의 가운데 배치
- 클릭 시: Tooltip 컴포넌트(position="top")를 트리거하여 숨겨진 에이전트 이름 목록을 표시
  - Tooltip 내용: 줄바꿈 구분 에이전트 이름 리스트 (최대 10명, 이후 "...외 N명")
  - 단, 현재 Tooltip 컴포넌트는 `content: string`만 받으므로, 이름을 "Agent-A, Agent-B, Agent-C" 형태의 쉼표 구분 문자열로 전달
- "+N" 뱃지 내 각 이름은 클릭 불가 (Tooltip은 hover 기반, 목록은 정보 확인용)

### F-004: 에이전트 말풍선 (CRIT-009 반영)

**유저 문제 해결**: 호버/클릭 없이 에이전트의 현재 활동을 1초 이내에 파악한다.

**상세** (01-spec.md 유지, 아래 수정사항만 적용):

- 말풍선 위치: 에이전트 캐릭터 `top: -40px` (에이전트 wrapper 기준, absolute)
- 말풍선 내용 및 아이콘은 인라인 SVG로 구현 (CRIT-005 패턴 동일):
  - working: 키보드 아이콘 SVG (16x16) + "작업 중..."
  - speaking: 말풍선 아이콘 SVG (16x16) + "대화 중"
  - tool_calling: 렌치 아이콘 SVG (16x16) + "도구 실행 중"
  - error: 경고 아이콘 SVG (16x16) + "오류 발생!" (배경: `var(--owm-error)` opacity 0.1)
  - idle: 말풍선 표시하지 않음
  - offline: 말풍선 표시하지 않음

**idle Zzz 애니메이션** (CRIT-009 해결):
- idle 상태의 에이전트 캐릭터 상단 오른쪽에 "Zzz" 텍스트 표시
- 위치: 에이전트 wrapper 기준 `top: -20px`, `right: -8px`
- 스타일: font-size 11px, font-weight 600, color `var(--owm-text-secondary)`, opacity 0.6
- 애니메이션: 기존 `animate-float` 클래스 적용 (global.css의 `float-y` keyframe: translateY 0 to -4px, 3s ease-in-out infinite)

**말풍선 꼬리(tail)**:
- CSS border trick 사용: `width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid var(--owm-bg-card)`, position: absolute, bottom: -5px, left: calc(50% - 5px)
- error 상태에서 tail 색상: `border-top-color` = `var(--owm-error)` opacity 0.1 대신 card와 동일 (일관성)

### F-005: 존 라벨 및 구역 표시

**유저 문제 해결**: 유저가 각 구역의 의미를 즉시 파악한다.

**상세** (01-spec.md 유지, 변경 없음):
- 라벨 위치: 각 존의 가로 중앙, 컨테이너 상단에서 `top: 8px` (absolute)
- 라벨 아이콘: 인라인 SVG 14x14px (기존 프로젝트 인라인 SVG 패턴 사용)
- 라벨별 left 좌표:
  - "입구": left: 3%
  - "라운지": left: 17%
  - "작업 데스크": left: 40%
  - "미팅 룸": left: 67%
  - "도구 창고": left: 86%
- 인원수 뱃지: Badge 컴포넌트 variant="neutral" size="sm" (기존 컴포넌트 재사용)

**존 라벨 아이콘 SVG** (인라인, 14x14):
```
입구 (문 아이콘): <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="2" width="14" height="20" rx="2"/><circle cx="14" cy="12" r="1.5" fill="currentColor"/><path d="M17 2h4v20h-4"/></svg>

라운지 (커피 아이콘): <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><path d="M6 2v3M10 2v3M14 2v3"/></svg>

작업 데스크 (모니터 아이콘): <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>

미팅 룸 (말풍선 아이콘): <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>

도구 창고 (책 아이콘): <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
```

### F-006: 활동 로그 피드 (CRIT-001, CRIT-004, CRIT-005 반영)

**유저 문제 해결**: 에이전트의 시간순 활동 이력을 실시간으로 확인한다.

**데이터 소스 아키텍처** (CRIT-001 해결):

`useAgentActivity` 훅을 다음과 같이 확장한다:

1. 새로운 타입 추가 (hooks/useAgentActivity.ts 상단):
```typescript
/** 활동 로그 엔트리 */
export interface ActivityLogEntry {
  id: string              // crypto.randomUUID() 또는 Date.now().toString(36)
  timestamp: number       // Date.now()
  agentId: string
  agentName: string
  avatarSeed: number
  type: 'session.started' | 'session.updated' | 'session.ended'
  message: string         // "세션 시작", "작업 중", "세션 종료" 등
}
```

2. 훅 내부에 상태 추가:
```typescript
const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
```

3. `onMessage` 콜백 내 로그 push 로직 (기존 setAgents 로직 다음에 추가):
```typescript
// session.started
if (msg.type === 'session.started' && msg.session) {
  const agent = sessionToAgent(msg.session)
  setActivityLogs(prev => {
    const entry: ActivityLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      agentId: agent.id,
      agentName: agent.name,
      avatarSeed: agent.avatarSeed,
      type: 'session.started',
      message: '세션 시작'
    }
    const next = [entry, ...prev]
    return next.length > 50 ? next.slice(0, 50) : next
  })
}

// session.updated
if (msg.type === 'session.updated' && msg.session) {
  const agent = sessionToAgent(msg.session)
  setActivityLogs(prev => {
    const entry: ActivityLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      agentId: agent.id,
      agentName: agent.name,
      avatarSeed: agent.avatarSeed,
      type: 'session.updated',
      message: agent.lastAction
    }
    const next = [entry, ...prev]
    return next.length > 50 ? next.slice(0, 50) : next
  })
}

// session.ended
if (msg.type === 'session.ended') {
  setActivityLogs(prev => {
    const entry: ActivityLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      agentId: msg.sessionId,
      agentName: msg.sessionId?.slice(0, 6) || 'unknown',
      avatarSeed: hashString(msg.sessionId || ''),
      type: 'session.ended',
      message: '세션 종료'
    }
    const next = [entry, ...prev]
    return next.length > 50 ? next.slice(0, 50) : next
  })
}
```

4. 반환 객체에 추가:
```typescript
return {
  agents,
  loading,
  error,
  wsConnected,
  refresh: fetchAgents,
  totalSessions: agents.length,
  activeSessions: agents.filter(...).length,
  activityLogs,   // 추가
}
```

**seedToColors 추출** (CRIT-004 해결):
- `components/ui/AgentAvatar.tsx` 내의 `function seedToColors(seed: number)` 함수를 `lib/utils.ts`로 이동
- `lib/utils.ts`에 `export function seedToColors(seed: number): { body: string; accent: string; detail: string }` 추가
- `AgentAvatar.tsx`에서 `import { seedToColors } from '../../lib/utils'`로 변경
- `ActivityLogFeed` 컴포넌트에서도 `import { seedToColors } from '../../lib/utils'`로 사용

**로그 피드 UI 상세**:
- 위치: 오피스 뷰 바로 아래, full-width
- 높이: 펼친 상태 120px (고정), 접힌 상태 32px
- 배경: `var(--owm-bg-card)`, border-top: 1px solid `var(--owm-border)`, border-radius 0 0 12px 12px
- 각 로그 행: 높이 24px, padding 0 12px, 행간 borderBottom 없음
- 로그 형식: `[HH:MM:SS] 에이전트명: 활동내용`
  - 시간: font-mono, font-size 11px, color text-secondary
  - 에이전트명: font-mono, font-size 11px, color = `seedToColors(avatarSeed).body`
  - 활동내용: font-mono, font-size 11px, color text-primary
- overflow-y: auto (세로 스크롤)
- 새 로그 추가 시 자동 스크롤: useRef로 컨테이너 참조, useEffect에서 `scrollTop = scrollHeight`
- 최대 50건 유지 (FIFO)
- 빈 상태: "아직 활동 기록이 없습니다. 에이전트가 활동하면 여기에 표시됩니다." (text-secondary, italic, 중앙 정렬, font-size 12px)

**접기/펼치기 토글 버튼** (CRIT-005 해결):
- 위치: 로그 피드 헤더 우상단
- 인라인 SVG 아이콘 (프로젝트 기존 패턴: Sidebar.tsx 참조):
```
ChevronDown: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>

ChevronUp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
```
- 접힌 상태: ChevronUp 아이콘 표시 (클릭 시 펼침)
- 펼친 상태: ChevronDown 아이콘 표시 (클릭 시 접기)
- 토글 시 높이 전환 애니메이션: `transition: height 200ms ease-out`
- 접힌 상태에서는 로그 헤더("활동 로그") + 마지막 1건만 표시

### F-007: 오피스 헤더 개선 (CRIT-011 반영)

**유저 문제 해결**: 오피스 상태를 헤더에서 빠르게 확인하되, 게임 HUD 느낌을 유지한다.

**상세** (01-spec.md 유지, 아래 수정사항만 적용):
- 기존 헤더 구조 유지 (제목, 배지, 새로고침 버튼)
- 추가: 현재 시간 표시 (HH:MM 형식, 1분 간격 `setInterval`로 갱신)
- 시간 표시 스타일: font-mono, font-size 14px, text-secondary, 새로고침 버튼 오른쪽에 배치

**에러 배너와 새로고침 구분** (CRIT-011 해결):
- 에러 배너: 오피스 컨테이너 상단, 내부 absolute z-50
  - 스타일: Alert 컴포넌트 variant="error" 사용. 추가로 dismissible=true, onDismiss = `() => setError(null)`
  - 내부 텍스트: `세션 데이터 조회 실패: {error 메시지}`
  - 재시도 버튼: Button variant="secondary" size="sm", 텍스트 "재시도"
  - 재시도 동작: `refresh()` 호출 (fetchAgents). refresh는 내부에서 `setError(null)` + `setLoading(true)`를 이미 수행하므로 에러 배너가 자동 사라짐
- 헤더 새로고침 버튼: `refresh()` 호출 (동일 함수). 에러 배너 유무와 무관하게 항상 동작
- 차이점: 에러 배너 재시도는 "에러 상태에서의 복구 경로"이고, 헤더 새로고침은 "정상 상태에서의 수동 갱신". 동일 함수 호출이지만 맥락이 다르므로 중복이 아닌 일관된 UX

### F-008: 로딩 상태 오피스 스켈레톤

**유저 문제 해결**: 데이터 로딩 중에도 "오피스"가 로드되고 있음을 시각적으로 전달한다.

**상세** (01-spec.md 유지, 변경 없음):
- 별도 `OfficeSkeleton` 컴포넌트로 구현
- 스켈레톤 구성:
  - 전체 크기: width 100%, height 420px (오피스와 동일)
  - 바닥선 위치(bottom 20%): 가로선 (animate-pulse, bg-bg-secondary, h-0.5)
  - 5개 존 위치: 직사각형 블록 (animate-pulse, bg-bg-secondary/60, 각 존별 width)
    - entrance: width 12%, height 60%
    - lounge: width 18%, height 50%
    - desk: width 32%, height 70%
    - meeting: width 20%, height 55%
    - bookshelf: width 18%, height 65%
  - 각 블록은 bottom 20%에서 위로 솟는 형태 (absolute, bottom: 20%)
- 로딩 상태 하단: 활동 로그 스켈레톤 (height 120px, animate-pulse)

### F-009: 에이전트 0명 빈 오피스

**유저 문제 해결**: 에이전트가 없어도 "준비된 공간"으로 보여, 연결 후 에이전트가 올 것이라는 기대감을 준다.

**상세** (01-spec.md 유지, 변경 없음):
- `agents.length === 0` 조건:
  - 오피스 배경(벽면, 바닥선) 정상 표시
  - 가구 SVG 모두 정상 표시
  - 존 라벨 정상 표시 (인원수 뱃지 미표시)
  - 기존 Card + "오피스가 비어있습니다" 텍스트 제거
  - desk 존 중앙(left: 40%, bottom: 35%)에 반투명 안내 패널:
    - container: `bg-card/60 backdrop-blur-sm rounded-lg p-4 px-6`
    - 주 텍스트: "에이전트를 기다리는 중..." (14px, semibold, text-secondary opacity 0.6)
    - 부 텍스트: "에이전트 세션이 시작되면 오피스에 자동으로 나타납니다" (12px, regular, text-secondary opacity 0.5)
  - 활동 로그 피드: 빈 상태 메시지 표시

### F-010: AgentDetailPanel 위치 변경 (CRIT-007 반영)

**유저 문제 해결**: 에이전트 상세 정보를 오피스 뷰 옆에서 확인하여, 오피스 뷰를 가리지 않는다.

**상세**:
- 기존: 오피스 뷰 하단 Card 형태
- 변경: 오피스 오른쪽 사이드 패널 (슬라이드 인)
- 사이드 패널 CSS:
  - width: 320px 고정
  - height: 오피스 컨테이너 + 로그 피드와 동일 높이 (flex 컨테이너로 맞춤)
  - background: var(--owm-bg-card)
  - border-left: 1px solid var(--owm-border)
  - 등장 애니메이션: `transition: transform 200ms ease-out`, 닫힘 시 `translateX(100%)`, 열림 시 `translateX(0)`
  - 닫기 버튼: 우상단, 인라인 SVG X 아이콘 (Sidebar.tsx 닫기 버튼 패턴 동일)
- 패널 열림 시:
  - 오피스 컨테이너와 사이드 패널을 `display: flex`로 가로 배치
  - 오피스 컨테이너: `flex: 1; min-width: 0` (유연하게 줄어듦)
  - 사이드 패널: `flex-shrink: 0; width: 320px`

**오버레이 전환 기준** (CRIT-007 해결):
- 기존: "1280px 미만 화면"
- 변경: CSS 미디어쿼리 `@media (max-width: 1359px)` 적용
  - 계산 근거: 사이드바 240px + 오피스 min-width 800px + 사이드 패널 320px = 1360px
  - 1359px 이하: 사이드 패널을 오버레이 모달로 표시
    - `position: fixed`, `right: 0`, `top: 0`, `bottom: 0`, `z-index: 50`
    - backdrop: `position: fixed, inset: 0, bg-black/50, z-index: 40`
    - backdrop 클릭 시 패널 닫힘
  - 1360px 이상: 사이드 패널을 인라인으로 표시 (flex 형태)
- 오버레이 모달 상태에서도 ESC 키로 닫기 가능

**패널 내용** (기존 AgentDetailPanel 구조 유지):
- 큰 아바타 (size="lg", 64px)
- 이름 (18px, bold)
- StateBadge (기존 컴포넌트)
- RPG 스탯 4개 (플랫폼, 메시지 EXP, 가동 시간, 마지막 활동)
- 경험치 바 (레벨 표시)
- 사이드 패널이므로 레이아웃을 세로(column) 배치로 변경 (기존 가로 배치에서)

---

## Section B: 컴포넌트 트리 + Props 인터페이스

### 전체 컴포넌트 트리

```
Page (pages/monitor/agents/+Page.tsx)
  |
  +-- [connectionLoading] --> LoadingSkeleton (기존, variant="grid")
  +-- [!isConnected] --> SetupRequired (기존)
  +-- [loading] --> OfficeSkeleton (신규)
  +-- [정상 상태]
       |
       +-- OfficeHeader (수정)
       |    +-- Badge (기존, 3개: 실시간/활동중/총원)
       |    +-- Button (기존, 새로고침)
       |    +-- OfficeClock (신규)
       |
       +-- OfficeFlexContainer (신규, display: flex)
       |    |
       |    +-- OfficeContainer (신규, flex: 1)
       |    |    |
       |    |    +-- OfficeBackground (신규, SVG 배경)
       |    |    |
       |    |    +-- OfficeFurniture (신규, React.memo)
       |    |    |    +-- FurnitureItem x15 (신규, React.memo)
       |    |    |
       |    |    +-- ZoneLabel x5 (신규)
       |    |    |    +-- Badge (기존)
       |    |    |
       |    |    +-- [agents.length === 0] --> EmptyOfficeOverlay (신규)
       |    |    |
       |    |    +-- [에러 시] --> Alert (기존, variant="error")
       |    |    |                  +-- Button (기존, 재시도)
       |    |    |
       |    |    +-- AgentCharacterOnFloor x N (신규)
       |    |         +-- SpeechBubble (신규) 또는 IdleZzz (신규)
       |    |         +-- AgentAvatar (기존)
       |    |         +-- 이름 라벨 (span)
       |    |         +-- ["+N" 뱃지 시] --> Tooltip (기존) + Badge (기존)
       |    |
       |    +-- [selectedAgent] --> AgentSidePanel (신규)
       |         +-- AgentAvatar (기존, size="lg")
       |         +-- StateBadge (기존)
       |         +-- StatItem x4 (기존)
       |         +-- 경험치 바 (기존)
       |
       +-- ActivityLogFeed (신규)
            +-- ActivityLogEntry x N (신규)
```

### 컴포넌트 상세

#### 1. OfficeSkeleton

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부 (페이지 전용)
// 기존 컴포넌트 재사용: 없음 (신규)

interface OfficeSkeletonProps {}
// Props 없음, 상태 없음

// 렌더링:
// - 전체: width 100%, height 420px, bg-bg-secondary/30, rounded-xl, overflow-hidden, relative
// - 바닥선: absolute, bottom: 20%, left: 0, right: 0, h-0.5, bg-bg-secondary, animate-pulse
// - 5개 존 블록: absolute, bottom: 20%, 각 존 left/width에 맞춤, animate-pulse, bg-bg-secondary/60
//   stagger: 각 블록에 animation-delay 100ms 간격 (inline style)
// - 하단 로그 영역: width 100%, h-[120px], bg-bg-secondary/20, animate-pulse, rounded-b-xl
```

#### 2. OfficeHeader

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부 (기존 헤더 영역 수정)
// 기존 컴포넌트 재사용: Badge, Button

interface OfficeHeaderProps {
  wsConnected: boolean
  activeSessions: number
  totalSessions: number
  onRefresh: () => void
}

// 렌더링:
// - flex items-center justify-between mb-4
// - 좌: h2 "에이전트 오피스" (text-xl font-bold text-text-primary)
// - 우: flex items-center gap-2
//   - Badge variant={wsConnected ? 'success' : 'error'}: wsConnected ? '실시간' : '연결 끊김'
//   - Badge variant="info": `${activeSessions} 활동중`
//   - Badge variant="neutral": `${totalSessions} 총원`
//   - Button variant="secondary" size="sm" onClick={onRefresh}: "새로고침"
//   - OfficeClock
```

#### 3. OfficeClock

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: 없음

interface OfficeClockProps {}
// Props 없음

// 내부 상태: const [time, setTime] = useState(new Date())
// useEffect: setInterval(() => setTime(new Date()), 60000) + cleanup
// 렌더링: <span className="font-mono text-sm text-text-secondary">{HH:MM}</span>
// HH:MM 형식: String(time.getHours()).padStart(2,'0') + ':' + String(time.getMinutes()).padStart(2,'0')
```

#### 4. OfficeFlexContainer

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 역할: 오피스 컨테이너와 사이드 패널의 flex 부모

interface OfficeFlexContainerProps {
  children: React.ReactNode
}

// 렌더링: <div className="flex gap-0">{children}</div>
```

#### 5. OfficeContainer

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 역할: 오피스 전체 배경 + 가구 + 에이전트를 담는 메인 컨테이너

interface OfficeContainerProps {
  agents: AgentActivity[]
  selectedAgent: AgentActivity | null
  onAgentClick: (agent: AgentActivity) => void
  onBackgroundClick: () => void  // 빈 영역 클릭 시 패널 닫기
  error: string | null
  onRetry: () => void
}

// 렌더링:
// - div.relative.overflow-hidden.rounded-xl.border.border-border
//   style={{ minHeight: 420, maxHeight: 520, height: '50vh', minWidth: 800 }}
//   className="flex-1 min-w-0"
//   onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick() }}
//
// 자식 (z-index 순서):
// 1. <OfficeBackground /> (z-0)
// 2. <OfficeFurniture /> (z-10)
// 3. <ZoneLabel /> x5 (z-10)
// 4. {agents.length === 0 && <EmptyOfficeOverlay />} (z-40)
// 5. {error && <에러 배너>} (z-50)
// 6. {agents.map(agent => <AgentCharacterOnFloor />)} (z-20)
```

#### 6. OfficeBackground

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 역할: SVG 배경 (벽면, 바닥, 바닥선, 존 구분선)

interface OfficeBackgroundProps {}
// Props 없음, 순수 장식

// 렌더링:
// <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="none" style={{ zIndex: 0 }}>
//   <rect x="0" y="0" width="1000" height="400" fill="var(--owm-bg-secondary)" />
//   <rect x="0" y="400" width="1000" height="100" fill="var(--owm-bg-primary)" opacity="0.5" />
//   <line x1="0" y1="400" x2="1000" y2="400" stroke="var(--owm-border)" strokeWidth="2" />
//   {[120, 300, 620, 800].map(x => (
//     <line key={x} x1={x} y1="100" x2={x} y2="400"
//       stroke="var(--owm-border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
//   ))}
// </svg>

// React.memo로 래핑 (정적 컴포넌트, 리렌더링 불필요)
```

#### 7. OfficeFurniture

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 역할: 15개 가구를 absolute 배치로 렌더링

interface OfficeFurnitureProps {}
// Props 없음

// React.memo로 래핑 (CRIT-010 반영)
// 가구 데이터를 상수 배열로 정의 (컴포넌트 외부):
// const FURNITURE_ITEMS = [
//   { id: 'door', left: '1%', bottom: '20%', width: 30, height: 60, viewBox: '0 0 30 60', paths: [...] },
//   ...15개
// ]

// 렌더링:
// <>
//   {FURNITURE_ITEMS.map(item => (
//     <FurnitureItem key={item.id} {...item} />
//   ))}
// </>
```

#### 8. FurnitureItem

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부

interface FurnitureItemProps {
  id: string
  left: string          // CSS 퍼센트 (예: "14%")
  bottom: string        // CSS 퍼센트 (예: "20%")
  width: number         // px
  height: number        // px
  viewBox: string       // SVG viewBox
  paths: string         // SVG 내부 요소 JSX (문자열 아닌 ReactNode로 실제 구현)
}

// React.memo로 래핑
// 렌더링:
// <div
//   className="absolute pointer-events-none"
//   style={{ left, bottom, width, height, zIndex: 10 }}
// >
//   <svg
//     width={width} height={height} viewBox={viewBox}
//     stroke="var(--owm-text-secondary)" strokeOpacity="0.5" strokeWidth="1.5"
//     fill="var(--owm-bg-card)" fillOpacity="0.3"
//   >
//     {paths}
//   </svg>
// </div>
```

#### 9. ZoneLabel

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: Badge

interface ZoneLabelProps {
  name: string         // "입구", "라운지", "작업 데스크", "미팅 룸", "도구 창고"
  icon: React.ReactNode  // 인라인 SVG
  left: string         // CSS 퍼센트
  agentCount: number   // 해당 존의 에이전트 수
}

// 렌더링:
// <div
//   className="absolute flex items-center gap-1"
//   style={{ left, top: 8, zIndex: 10 }}
// >
//   <span className="flex items-center gap-1 bg-card/80 px-2 py-0.5 rounded text-[11px] font-semibold text-text-secondary">
//     {icon}
//     {name}
//   </span>
//   {agentCount > 0 && <Badge variant="neutral" size="sm">{agentCount}</Badge>}
// </div>
```

#### 10. AgentCharacterOnFloor

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: AgentAvatar, Tooltip, Badge

interface AgentCharacterOnFloorProps {
  agent: AgentActivity
  isSelected: boolean
  onClick: () => void
  left: string           // CSS 퍼센트 (존 시작 + index * 4%)
  bottom: string         // CSS 퍼센트 (존별 고정값)
}

// 렌더링:
// <button
//   className="absolute flex flex-col items-center transition-[left,bottom] duration-[400ms] ease-out"
//   style={{ left, bottom, zIndex: 20, transform: 'translateX(-50%)' }}
//   onClick={onClick}
// >
//   {/* 말풍선 또는 Zzz */}
//   {agent.state !== 'idle' && agent.state !== 'offline' && (
//     <SpeechBubble state={agent.state} message={getLastActionText(agent.state, agent.platform)} />
//   )}
//   {agent.state === 'idle' && <IdleZzz />}
//
//   {/* 아바타 */}
//   <AgentAvatar seed={agent.avatarSeed} state={agent.state} name={agent.name} size="md" />
//
//   {/* 이름 */}
//   <span className="text-[10px] font-medium text-text-primary max-w-[52px] truncate text-center">
//     {agent.name}
//   </span>
//
//   {/* 선택 인디케이터 */}
//   {isSelected && (
//     <div className="w-6 h-0.5 bg-accent rounded-full mt-0.5" />
//   )}
// </button>

// transition-[left,bottom]: CSS transition을 left, bottom 속성에만 적용 (CRIT-006)
// Tailwind v4에서 arbitrary transition: transition-[left,bottom]
```

#### 11. OverflowBadge (+N 뱃지)

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: Tooltip, Badge

interface OverflowBadgeProps {
  hiddenAgents: AgentActivity[]   // 7번째 이후 에이전트 배열
  left: string                     // CSS 퍼센트
  bottom: string                   // CSS 퍼센트
}

// 렌더링:
// <Tooltip
//   content={hiddenAgents.slice(0, 10).map(a => a.name).join(', ') + (hiddenAgents.length > 10 ? ` ...외 ${hiddenAgents.length - 10}명` : '')}
//   position="top"
// >
//   <div
//     className="absolute flex items-center justify-center"
//     style={{ left, bottom, zIndex: 20, width: 48, height: 48 }}
//   >
//     <Badge variant="neutral" size="sm">+{hiddenAgents.length}</Badge>
//   </div>
// </Tooltip>
```

#### 12. SpeechBubble

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: 없음

interface SpeechBubbleProps {
  state: 'working' | 'speaking' | 'tool_calling' | 'error'
  message: string
}

// 상태별 아이콘 (인라인 SVG 16x16):
// working: 키보드 아이콘
// speaking: 말풍선 아이콘
// tool_calling: 렌치 아이콘
// error: 경고 삼각형 아이콘

// 렌더링:
// <div className={cn(
//   "absolute -top-10 left-1/2 -translate-x-1/2",
//   "flex items-center gap-1 px-2 py-1 rounded-lg max-w-[120px]",
//   "text-[10px] whitespace-nowrap overflow-hidden text-ellipsis",
//   "animate-in fade-in slide-in-from-bottom-1 duration-200",
//   state === 'error'
//     ? "bg-error/10 border border-error/30 text-error"
//     : "bg-card border border-border text-text-primary"
// )} style={{ zIndex: 30 }}>
//   {icon}
//   <span className="truncate">{message}</span>
//   {/* tail */}
//   <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0
//     border-l-[5px] border-l-transparent
//     border-r-[5px] border-r-transparent
//     border-t-[5px]"
//     style={{ borderTopColor: state === 'error' ? 'var(--owm-error)' : 'var(--owm-bg-card)', opacity: state === 'error' ? 0.1 : 1 }}
//   />
// </div>

// 말풍선 등장/퇴장 애니메이션:
// CSS: @keyframes fade-in-up { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
// 또는 Tailwind animate 유틸리티로 처리
// 사라질 때: React key 변경 시 자동 unmount (별도 exit 애니메이션 미적용 -- 복잡도 대비 가치 낮음)
```

#### 13. IdleZzz

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부

interface IdleZzzProps {}
// Props 없음

// 렌더링:
// <span
//   className="absolute -top-5 -right-2 text-[11px] font-semibold text-text-secondary/60 animate-float"
//   style={{ zIndex: 30 }}
// >
//   Zzz
// </span>

// animate-float: global.css에 이미 정의됨 (float-y keyframe, translateY 0 to -4px, 3s)
```

#### 14. EmptyOfficeOverlay

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부

interface EmptyOfficeOverlayProps {}
// Props 없음

// 렌더링:
// <div
//   className="absolute flex flex-col items-center justify-center"
//   style={{ left: '40%', bottom: '35%', transform: 'translateX(-50%)', zIndex: 40 }}
// >
//   <div className="bg-card/60 backdrop-blur-sm rounded-lg p-4 px-6 text-center">
//     <p className="text-sm font-semibold text-text-secondary/60">에이전트를 기다리는 중...</p>
//     <p className="text-xs text-text-secondary/50 mt-1">에이전트 세션이 시작되면 오피스에 자동으로 나타납니다</p>
//   </div>
// </div>
```

#### 15. AgentSidePanel

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: AgentAvatar, Badge, Button

interface AgentSidePanelProps {
  agent: AgentActivity
  onClose: () => void
}

// 데스크탑 (>= 1360px):
// <div
//   className="flex-shrink-0 w-[320px] bg-card border-l border-border overflow-y-auto
//     transition-transform duration-200 ease-out"
//   style={{ zIndex: 10 }}
// >
//   {panelContent}
// </div>

// 모바일 (< 1360px, 미디어쿼리 또는 useMediaQuery):
// <>
//   <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
//   <div className="fixed right-0 top-0 bottom-0 w-[320px] bg-card border-l border-border z-50
//     overflow-y-auto transition-transform duration-200 ease-out">
//     {panelContent}
//   </div>
// </>

// panelContent 내부 (세로 레이아웃):
// - 닫기 버튼 (우상단, absolute)
// - AgentAvatar size="lg" (중앙 정렬)
// - StateBadge
// - 이름 (text-lg font-bold)
// - lastAction (text-sm text-text-secondary)
// - RPG 스탯 4개 (세로 2열 grid)
// - 경험치 바

// ESC 키 닫기: useEffect에서 keydown 'Escape' 리스너 등록 (Sidebar.tsx 패턴 동일)

// useMediaQuery 구현:
// 페이지 내부에 간단한 hook으로 구현:
// function useIsWideScreen() {
//   const [isWide, setIsWide] = useState(false)
//   useEffect(() => {
//     const mql = window.matchMedia('(min-width: 1360px)')
//     setIsWide(mql.matches)
//     const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
//     mql.addEventListener('change', handler)
//     return () => mql.removeEventListener('change', handler)
//   }, [])
//   return isWide
// }
```

#### 16. ActivityLogFeed

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부
// 기존 컴포넌트 재사용: 없음

interface ActivityLogFeedProps {
  logs: ActivityLogEntry[]
}

// 내부 상태:
// const [collapsed, setCollapsed] = useState(false)
// const scrollRef = useRef<HTMLDivElement>(null)
// useEffect: 새 로그 추가 시 scrollRef.current.scrollTop = scrollRef.current.scrollHeight

// 렌더링:
// <div className="w-full bg-card border-t border-border rounded-b-xl overflow-hidden"
//   style={{ height: collapsed ? 32 : 120, transition: 'height 200ms ease-out' }}
// >
//   {/* 헤더 */}
//   <div className="flex items-center justify-between px-3 h-8">
//     <span className="text-xs font-semibold text-text-secondary">활동 로그</span>
//     <button onClick={() => setCollapsed(!collapsed)} className="p-1 text-text-secondary hover:text-text-primary">
//       {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
//     </button>
//   </div>
//
//   {/* 로그 목록 */}
//   {!collapsed && (
//     <div ref={scrollRef} className="overflow-y-auto px-3 pb-2" style={{ height: 'calc(120px - 32px)' }}>
//       {logs.length === 0 ? (
//         <p className="text-xs text-text-secondary/60 italic text-center py-4">
//           아직 활동 기록이 없습니다. 에이전트가 활동하면 여기에 표시됩니다.
//         </p>
//       ) : (
//         logs.map(log => <LogEntry key={log.id} log={log} />)
//       )}
//     </div>
//   )}
//
//   {/* 접힌 상태: 마지막 1건만 */}
//   {collapsed && logs.length > 0 && (
//     <div className="px-3 truncate">
//       <LogEntry log={logs[0]} />
//     </div>
//   )}
// </div>

// ChevronDownIcon, ChevronUpIcon: F-006에서 정의한 인라인 SVG
```

#### 17. LogEntry (ActivityLogFeed 내부)

```typescript
// 위치: pages/monitor/agents/+Page.tsx 내부

interface LogEntryProps {
  log: ActivityLogEntry
}

// 렌더링:
// <div className="flex items-center gap-2 h-6 text-[11px] font-mono">
//   <span className="text-text-secondary">
//     [{formatTime(log.timestamp)}]
//   </span>
//   <span style={{ color: seedToColors(log.avatarSeed).body }}>
//     {log.agentName}:
//   </span>
//   <span className="text-text-primary truncate">
//     {log.message}
//   </span>
// </div>

// formatTime: new Date(timestamp) -> HH:MM:SS
// function formatTime(ts: number): string {
//   const d = new Date(ts)
//   return [d.getHours(), d.getMinutes(), d.getSeconds()]
//     .map(n => String(n).padStart(2, '0')).join(':')
// }
```

### 에이전트 배치 계산 로직

페이지 컴포넌트 내에 다음 유틸 함수를 정의한다:

```typescript
// 존별 에이전트 배치 좌표 계산
const ZONE_CONFIG: Record<AgentLocation, { startLeft: number; stepLeft: number; bottom: string }> = {
  entrance:  { startLeft: 3,  stepLeft: 4, bottom: '21%' },
  lounge:    { startLeft: 17, stepLeft: 4, bottom: '21%' },
  desk:      { startLeft: 38, stepLeft: 4, bottom: '25%' },
  meeting:   { startLeft: 70, stepLeft: 4, bottom: '21%' },
  bookshelf: { startLeft: 85, stepLeft: 4, bottom: '21%' },
}

function getAgentPosition(
  agent: AgentActivity,
  indexInZone: number
): { left: string; bottom: string } {
  const config = ZONE_CONFIG[agent.location]
  return {
    left: `${config.startLeft + indexInZone * config.stepLeft}%`,
    bottom: config.bottom,
  }
}

// 존별로 에이전트를 그룹화
function groupByZone(agents: AgentActivity[]): Record<AgentLocation, AgentActivity[]> {
  const groups: Record<AgentLocation, AgentActivity[]> = {
    entrance: [], lounge: [], desk: [], meeting: [], bookshelf: [],
  }
  agents.forEach(a => groups[a.location].push(a))
  return groups
}
```

### CSS 추가 사항 (global.css)

```css
/* Sprint-002: 말풍선 등장 애니메이션 */
@keyframes speech-bubble-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.animate-speech-bubble-in {
  animation: speech-bubble-in 200ms ease-out forwards;
}

/* Sprint-002: Zzz 부유 (기존 animate-float 재사용, 추가 정의 불필요) */
```

---

## Section C: 검증 체크리스트 (최종)

### 코드 검증 (도구 기반)

- [ ] `npm run build`가 에러 없이 통과한다 (측정: 빌드 실행, exit code 0)
- [ ] `npx tsc --noEmit`이 에러 없이 통과한다 (측정: tsc 실행)
- [ ] `pages/monitor/agents/+Page.tsx`에 `grid grid-cols-1 lg:grid-cols-3` 클래스가 존재하지 않는다 (측정: Grep 결과 0건)
- [ ] 오피스 컨테이너 요소에 `min-h-[420px]` 또는 `minHeight: 420` 스타일이 존재한다 (측정: Grep "420")
- [ ] SVG viewBox="0 0 1000 500" 배경 요소가 존재한다 (측정: Grep "0 0 1000 500" in agents page)
- [ ] 바닥선 SVG `<line>` 요소가 y1="400" y2="400"으로 존재한다 (측정: Grep "y1.*400.*y2.*400" 또는 직접 Read)
- [ ] 가구 SVG 요소가 15개 이상 존재한다 (측정: Grep "viewBox" count in agents page 또는 FURNITURE_ITEMS 배열 길이)
- [ ] 말풍선 컴포넌트(`SpeechBubble` 함수)가 존재한다 (측정: Grep "function SpeechBubble" in agents page)
- [ ] IdleZzz 컴포넌트(`function IdleZzz` 또는 "Zzz" 텍스트)가 존재한다 (측정: Grep "Zzz" in agents page)
- [ ] `animate-float` 클래스가 idle 상태에서 사용된다 (측정: Grep "animate-float" in agents page)
- [ ] 활동 로그 피드 컴포넌트(`ActivityLogFeed`)가 존재한다 (측정: Grep "ActivityLogFeed" in agents page)
- [ ] `useAgentActivity` 훅의 반환값에 `activityLogs`가 추가되었다 (측정: Read hooks/useAgentActivity.ts에서 `activityLogs` 존재 확인)
- [ ] `ActivityLogEntry` 타입이 export되어 있다 (측정: Grep "export.*ActivityLogEntry" in useAgentActivity.ts)
- [ ] `seedToColors` 함수가 `lib/utils.ts`에 export되어 있다 (측정: Grep "export.*seedToColors" in lib/utils.ts)
- [ ] `AgentAvatar.tsx`에서 `seedToColors`를 `lib/utils`에서 import한다 (측정: Grep "import.*seedToColors.*utils" in AgentAvatar.tsx)
- [ ] 에이전트 0명 시 "오피스가 비어있습니다" 텍스트가 더이상 존재하지 않는다 (측정: Grep "오피스가 비어있습니다" 결과 0건)
- [ ] 에이전트 0명 시 "에이전트를 기다리는 중" 텍스트가 존재한다 (측정: Grep "기다리는 중" in agents page)
- [ ] ChevronDown/ChevronUp 인라인 SVG가 존재한다 (측정: Grep "M6 9l6 6 6-6" 또는 "M18 15l-6-6-6 6" in agents page)
- [ ] 사이드 패널 width 320px가 정의되어 있다 (측정: Grep "320" in agents page)
- [ ] CSS `transition.*left.*bottom` 또는 `transition-\[left,bottom\]`이 에이전트 요소에 적용되어 있다 (측정: Grep "transition" in agents page)
- [ ] 에러 시 Alert 컴포넌트 또는 에러 배너가 재시도 버튼과 함께 존재한다 (측정: Grep "재시도" in agents page)
- [ ] OfficeSkeleton 컴포넌트가 존재한다 (측정: Grep "OfficeSkeleton" in agents page)
- [ ] 미디어쿼리 1360px가 사이드 패널 전환에 사용된다 (측정: Grep "1360" in agents page)
- [ ] ESC 키 닫기 이벤트 핸들러가 사이드 패널에 존재한다 (측정: Grep "Escape" in agents page)

---

## Section D: 화면별 기대 상태 (최종)

### 페이지: /monitor/agents (연결 확인 중)
- LoadingSkeleton variant="grid" lines={3}이 표시됨 (3개의 animate-pulse 직사각형)
- 오피스 뷰는 아직 표시되지 않음

### 페이지: /monitor/agents (미연결)
- SetupRequired 컴포넌트가 표시됨 (variant에 따라 setup/disconnected/error)
- 오피스 뷰는 표시되지 않음

### 페이지: /monitor/agents (데이터 로딩 중)
- OfficeSkeleton이 표시됨:
  - 420px 높이의 직사각형 영역 전체가 animate-pulse
  - 바닥선 위치(bottom 20%)에 animate-pulse 가로선이 보임
  - 5개 존 위치에 animate-pulse 직사각형 블록이 보임 (각각 다른 높이)
  - 하단에 120px 높이의 로그 영역 스켈레톤이 보임
- 기존 스피너 + "오피스를 불러오는 중..." 텍스트는 보이지 않음

### 페이지: /monitor/agents (빈 오피스, 에이전트 0명)
- 헤더: "에이전트 오피스", "실시간" 배지(녹색/빨간색), "0 활동중", "0 총원", "새로고침" 버튼, 현재 시간 HH:MM
- 오피스 영역:
  - 벽면(bg-secondary)이 상단 80% 영역에 보임
  - 바닥선(가로선)이 하단 20% 위치에 보임
  - 존 구분선(점선) 4개가 세로로 보임
  - 존 라벨 5개("입구", "라운지", "작업 데스크", "미팅 룸", "도구 창고")가 벽면 상단에 아이콘과 함께 보임
  - 인원수 뱃지는 보이지 않음 (0명이므로)
  - 가구 SVG 15개가 각 존에 보임 (문, 우산꽂이, 소파, 커피 테이블, 화분, 책상x2, 의자x2, 화이트보드, 둥근 테이블, 의자3개 세트, 책장x2, 사다리)
  - 에이전트 캐릭터는 보이지 않음
  - desk 존 중앙에 반투명 패널: "에이전트를 기다리는 중..." + "에이전트 세션이 시작되면 오피스에 자동으로 나타납니다"
- 활동 로그: "아직 활동 기록이 없습니다. 에이전트가 활동하면 여기에 표시됩니다." 이탤릭 메시지

### 페이지: /monitor/agents (에이전트 있음, 정상 상태)
- 헤더: 활동중/총원 뱃지에 실제 숫자가 표시됨
- 오피스 영역:
  - 배경 + 가구가 표시됨
  - 에이전트가 해당 상태의 존 바닥선 위에 서있음:
    - working 에이전트: desk 존, 바닥선보다 약간 위 (bottom 25%)
    - idle 에이전트: lounge 존, 바닥선 위 (bottom 21%)
    - speaking 에이전트: meeting 존, 바닥선 위 (bottom 21%)
    - tool_calling 에이전트: bookshelf 존, 바닥선 위 (bottom 21%)
    - offline 에이전트: entrance 존, 바닥선 위 (bottom 21%)
  - working/speaking/tool_calling 에이전트 위에 말풍선이 보임 (아이콘 + 텍스트)
  - error 에이전트 위에 빨간 배경 말풍선 "오류 발생!"이 보임
  - idle 에이전트 오른쪽 위에 "Zzz" 텍스트가 위아래로 부유하는 애니메이션 중
  - 각 에이전트 캐릭터 아래에 이름이 10px로 보임 (truncate)
  - 존 라벨 옆에 해당 존 인원수 뱃지가 보임
- 활동 로그: "[HH:MM:SS] 에이전트명: 활동내용" 형식 로그가 시간순으로 나열됨
  - 에이전트명은 해당 에이전트의 avatarSeed 기반 색상으로 표시됨
  - 로그 피드 접기/펼치기 버튼이 우상단에 보임

### 페이지: /monitor/agents (에이전트 선택됨, >= 1360px)
- 오피스 뷰 오른쪽에 320px 너비의 사이드 패널이 슬라이드되어 보임
- 오피스 뷰의 가로 폭이 사이드 패널만큼 줄어듦
- 사이드 패널 내용:
  - 우상단에 X 닫기 버튼
  - 큰 아바타 (64px) 중앙 정렬
  - 상태 뱃지 (StateBadge)
  - 에이전트 이름 (18px, bold)
  - 현재 활동 텍스트 (text-secondary)
  - RPG 스탯 4개 (플랫폼, 메시지 EXP, 가동 시간, 마지막 활동)
  - 경험치 바 + 레벨 표시
- 선택된 에이전트 캐릭터 아래에 accent 색상 인디케이터 바(6px x 2px)가 보임
- 오피스 빈 영역 클릭 시 사이드 패널이 닫힘

### 페이지: /monitor/agents (에이전트 선택됨, < 1360px)
- 오피스 뷰 위에 반투명 검정 배경(bg-black/50)이 덮임
- 화면 오른쪽에서 320px 너비의 패널이 슬라이드되어 나타남
- 패널 내용은 데스크탑과 동일
- 배경(backdrop) 클릭 시 패널이 닫힘
- ESC 키로도 패널이 닫힘

### 페이지: /monitor/agents (에러 상태)
- 오피스 영역 내부 상단에 Alert variant="error" 배너가 보임
  - 에러 메시지 텍스트: "세션 데이터 조회 실패: {에러 내용}"
  - "재시도" 버튼이 배너 내에 보임
  - X 닫기 버튼으로 배너만 닫을 수 있음
- 오피스 뷰 자체(배경, 가구, 마지막 에이전트 데이터)는 유지됨 (빈 화면 아님)
- 헤더의 "새로고침" 버튼도 여전히 동작

### 페이지: /monitor/agents (존에 7명 이상)
- 해당 존에 에이전트 6명이 표시됨
- 6번째 에이전트 옆에 "+N" 뱃지(Badge neutral sm)가 보임
- "+N" 뱃지에 마우스 호버 시 Tooltip으로 숨겨진 에이전트 이름 목록이 보임

### 페이지: /monitor/agents (활동 로그 접기)
- 로그 영역이 32px 높이로 줄어듦
- 헤더("활동 로그") + 마지막 1건의 로그만 보임
- ChevronUp 아이콘이 표시됨 (클릭 시 펼침)

---

## Section E: 수용 기준 (최종)

### AC-001: 유저가 오피스 전체를 하나의 연속 공간으로 볼 수 있다

- Step 1: `/monitor/agents` 페이지 진입 (Gateway 연결 상태)
- Step 2: 오피스 영역 확인
- 기대 결과: 5개 존이 하나의 직사각형 컨테이너 안에 가로로 배치되어 있다. 존 사이에 점선 구분선이 보이지만, 바닥선은 끊김 없이 이어진다. 별도의 Card/border로 존이 분리되어 있지 않다
- 실패 조건: 존별로 독립된 Card/border가 보임. grid gap으로 존 사이에 빈 공간이 있음. 바닥선이 존마다 끊김

### AC-002: 유저가 빈 오피스에서 가구와 안내를 볼 수 있다

- Step 1: `/monitor/agents` 진입 (에이전트 0명 상태)
- Step 2: 오피스 영역 확인
- 기대 결과:
  - 벽면, 바닥선, 존 구분선이 보임
  - 각 존에 가구 SVG가 표시됨 (문, 소파, 책상, 화이트보드, 책장 등)
  - 존 라벨 5개가 벽면 상단에 보임
  - desk 존 중앙에 "에이전트를 기다리는 중..." 반투명 안내 패널이 보임
  - "오피스가 비어있습니다" 텍스트는 보이지 않음
- 실패 조건: 가구 없이 빈 영역만 보임. "비어있습니다" 텍스트가 보임. 오피스 배경 자체가 없음

### AC-003: 유저가 에이전트의 상태를 호버/클릭 없이 파악할 수 있다

- Step 1: `/monitor/agents` 진입 (에이전트 1명 이상, working 상태 포함)
- Step 2: 에이전트 캐릭터 확인 (호버하지 않음)
- 기대 결과:
  - working 에이전트가 desk 존에 위치함
  - 캐릭터 위에 "작업 중..." 말풍선이 상시 표시됨 (호버 불필요)
  - working 애니메이션(scale 변화)이 동작함
  - 캐릭터 아래에 이름이 보임
- 실패 조건: 말풍선 없음. 상태 파악에 호버/클릭 필요. 에이전트가 어느 존에 있는지 구분 불가

### AC-004: 유저가 에이전트를 클릭하여 사이드 패널로 상세 정보를 볼 수 있다

- Step 1: `/monitor/agents`에서 에이전트 캐릭터 클릭
- Step 2: 사이드 패널 확인
- 기대 결과:
  - 오른쪽에 320px 너비의 사이드 패널이 슬라이드되어 나타남
  - 패널에 큰 아바타(64px), 이름, 상태 뱃지, 플랫폼, 메시지 수(EXP), 가동 시간, 마지막 활동, 경험치 바가 보임
  - 선택된 에이전트 캐릭터 아래에 accent 색상 인디케이터가 보임
  - X 버튼 클릭 시 패널이 닫힘
  - 오피스 빈 영역 클릭 시 패널이 닫힘
- 실패 조건: 패널 미표시. 오피스 하단 Card로 표시됨. 패널에 에이전트 정보 미표시. 닫기 불가

### AC-005: 유저가 활동 로그를 실시간으로 확인할 수 있다

- Step 1: `/monitor/agents` 진입 (에이전트 1명 이상)
- Step 2: 오피스 하단의 활동 로그 영역 확인
- 기대 결과:
  - "[HH:MM:SS] 에이전트명: 활동내용" 형식 로그가 시간순으로 나열됨
  - 에이전트명이 해당 에이전트의 고유 색상으로 표시됨
  - 새 WebSocket 이벤트 발생 시 로그가 자동으로 추가됨
  - 접기/펼치기 버튼이 동작함 (접기: 32px, 마지막 1건만. 펼치기: 120px, 전체 로그)
- 실패 조건: 로그 영역 미표시. 로그 항목 없음 (에이전트 존재에도). 실시간 업데이트 안 됨. 접기/펼치기 미동작

### AC-006: 유저가 로딩 중 오피스 스켈레톤을 볼 수 있다

- Step 1: `/monitor/agents` 진입 시 데이터 로딩 중
- 기대 결과:
  - 420px 높이의 오피스 실루엣 스켈레톤이 표시됨
  - 바닥선 위치에 animate-pulse 가로선이 보임
  - 5개 존 위치에 animate-pulse 직사각형 블록이 보임
  - 기존 스피너 + "오피스를 불러오는 중..." 텍스트는 보이지 않음
- 실패 조건: 기존 스피너가 보임. 빈 화면 표시. 스켈레톤 미표시

### AC-007: 유저가 에러 시 상황을 파악하고 재시도할 수 있다

- Step 1: 에러 상태 발생 (네트워크 실패 또는 API 에러)
- Step 2: 오피스 영역 확인
- 기대 결과:
  - 오피스 내부 상단에 에러 배너(빨간색)가 보임
  - 에러 메시지 + "재시도" 버튼이 보임
  - "재시도" 클릭 시 데이터 재조회 시도 (에러 배너 사라짐)
  - 오피스 뷰 자체는 마지막 데이터로 유지됨 (빈 화면 아님)
  - 헤더 "새로고침" 버튼도 동작함
- 실패 조건: 에러 무시. 빈 화면 전환. 재시도 버튼 없음. 재시도 후에도 에러 배너 유지

### AC-008: 1024px 화면에서 오피스가 접근 가능하다

- Step 1: 브라우저 폭 1024px으로 조정
- Step 2: `/monitor/agents` 확인
- 기대 결과:
  - 오피스 컨테이너가 min-width 800px를 유지하며 가로 스크롤로 접근 가능
  - 존 라벨, 가구, 에이전트 모두 잘림 없이 보임 (스크롤 시)
  - 레이아웃 깨짐 없음
- 실패 조건: 요소 겹침, 잘림, 레이아웃 깨짐. 가로 스크롤 없이 내용 숨겨짐

### AC-009: 다크/라이트 모드 모두에서 오피스가 정상 표시된다

- Step 1: 다크 모드에서 `/monitor/agents` 확인
- Step 2: 라이트 모드로 전환 후 확인
- 기대 결과:
  - 두 모드 모두에서 벽면, 바닥선, 가구, 에이전트, 말풍선, 로그가 가독성 있게 표시됨
  - CSS 변수(--owm-bg-secondary, --owm-border, --owm-text-secondary 등)가 모드에 따라 적절히 변환됨
  - 가구 SVG의 stroke/fill이 모드에 따라 가시적임
- 실패 조건: 특정 모드에서 요소가 배경에 묻혀 안 보임. 가구 SVG가 보이지 않음

### AC-010: 에이전트 상태 변경 시 존 이동이 자연스럽게 보인다

- Step 1: `/monitor/agents`에서 에이전트 상태 변경 발생 (WebSocket 이벤트)
- Step 2: 에이전트 캐릭터의 위치 변화 확인
- 기대 결과:
  - 에이전트가 이전 존에서 새 존으로 400ms 동안 슬라이딩 이동함
  - 갑자기 사라졌다 나타나는 것이 아닌 연속적인 이동
  - 이동 후 말풍선이 새 상태에 맞게 갱신됨
- 실패 조건: 에이전트가 즉시 텔레포트 (전환 애니메이션 없음). 이동 중 깜박임

### AC-011: < 1360px에서 사이드 패널이 오버레이로 표시된다

- Step 1: 브라우저 폭 1200px으로 조정
- Step 2: 에이전트 클릭
- 기대 결과:
  - 반투명 검정 배경이 전체 화면에 깔림
  - 오른쪽에서 320px 패널이 슬라이드되어 나타남
  - 배경 클릭 시 패널이 닫힘
  - ESC 키로 패널이 닫힘
  - 오피스 뷰 가로 폭은 줄어들지 않음 (오버레이이므로)
- 실패 조건: 인라인 패널로 표시되어 오피스가 800px 미만으로 줄어듦. 닫기 불가

---

## 부록: 말풍선 아이콘 SVG (인라인, 16x16)

```
키보드 아이콘 (working):
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>

말풍선 아이콘 (speaking):
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>

렌치 아이콘 (tool_calling):
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>

경고 아이콘 (error):
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
```
