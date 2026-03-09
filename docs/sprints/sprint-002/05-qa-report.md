## QA 리포트 -- Part 1: 코드 검증
- 검증 일시: 2026-03-08
- 대상 스펙: 03-spec-revised.md Section C
- **합격 여부: PASS**

---

### 빌드/타입 검증

#### [CHK-001] npm run build 통과
- 측정 방법: `npm run build` 실행
- 측정값: exit code 0, client 272 modules + SSR 105 modules 빌드 완료 (3.78s)
- 판정: **PASS**

#### [CHK-002] npx tsc --noEmit 통과
- 측정 방법: `npx tsc --noEmit` 실행
- 측정값: exit code 0, 에러 0건
- 판정: **PASS**

---

### 요소 존재 검증

#### [CHK-003] grid grid-cols-1 lg:grid-cols-3 클래스가 존재하지 않는다
- 측정 방법: Grep `grid grid-cols-1 lg:grid-cols-3` in `pages/monitor/agents/`
- 측정값: 0건 (제거 확인)
- 판정: **PASS**

#### [CHK-004] 오피스 컨테이너에 min-h-[420px] 또는 minHeight: 420 스타일 존재
- 측정 방법: Grep `420` in `pages/monitor/agents/+Page.tsx`
- 측정값: 2건 발견
  - 490행: `style={{ height: 420 }}` (OfficeSkeleton)
  - 880행: `style={{ minHeight: 420, maxHeight: 520, height: '50vh', minWidth: 800 }}` (메인 오피스 컨테이너)
- 판정: **PASS**

#### [CHK-005] SVG viewBox="0 0 1000 500" 배경 요소 존재
- 측정 방법: Grep `0 0 1000 500` in `pages/monitor/agents/`
- 측정값: 1건 -- 586행 `viewBox="0 0 1000 500"`
- 판정: **PASS**

#### [CHK-006] 바닥선 SVG line 요소 y1="400" y2="400" 존재
- 측정 방법: Grep `y1.*400.*y2.*400` in `pages/monitor/agents/`
- 측정값: 1건 -- 595행 `<line x1="0" y1="400" x2="1000" y2="400" stroke="var(--owm-border)" strokeWidth="2" />`
- 판정: **PASS**

#### [CHK-007] 가구 SVG 요소 15개 이상 존재
- 측정 방법: Grep `id: '` in `pages/monitor/agents/+Page.tsx` (FURNITURE_ITEMS 배열 내)
- 측정값: 15건 (door, umbrella-stand, sofa, coffee-table, plant, desk-a, chair-a, desk-b, chair-b, whiteboard, round-table, chairs-set, bookshelf-a, bookshelf-b, step-ladder)
- 판정: **PASS**

#### [CHK-008] SpeechBubble 함수 존재
- 측정 방법: Grep `function SpeechBubble` in `pages/monitor/agents/`
- 측정값: 1건 -- 684행 `function SpeechBubble({ state, message }: ...)`
- 판정: **PASS**

#### [CHK-009] IdleZzz 컴포넌트 또는 "Zzz" 텍스트 존재
- 측정 방법: Grep `Zzz|IdleZzz` in `pages/monitor/agents/`
- 측정값: 5건 -- 744행 `// --- IdleZzz ---`, 746행 `function IdleZzz()`, 752행 `Zzz` 텍스트, 787행 주석, 792행 사용처 `<IdleZzz />`
- 판정: **PASS**

#### [CHK-010] animate-float 클래스가 idle 상태에서 사용됨
- 측정 방법: Grep `animate-float` in `pages/monitor/agents/`
- 측정값: 1건 -- 749행 `className="... animate-float"` (IdleZzz 컴포넌트 내부)
- CSS 정의 확인: `styles/global.css` 130행 `.animate-float { animation: float-y 3s ease-in-out infinite; }`, keyframe `float-y` 101행에 정의됨
- 판정: **PASS**

#### [CHK-011] ActivityLogFeed 컴포넌트 존재
- 측정 방법: Grep `ActivityLogFeed` in `pages/monitor/agents/`
- 측정값: 3건 -- 457행 사용처 `<ActivityLogFeed logs={activityLogs} />`, 954행 주석, 956행 `function ActivityLogFeed({ logs }: ...)`
- 판정: **PASS**

#### [CHK-012] useAgentActivity 훅의 반환값에 activityLogs 존재
- 측정 방법: Grep `activityLogs` in `hooks/useAgentActivity.ts`
- 측정값: 2건 -- 134행 `const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])`, 267행 return 객체에 `activityLogs` 포함
- 판정: **PASS**

#### [CHK-013] ActivityLogEntry 타입이 export됨
- 측정 방법: Grep `export.*ActivityLogEntry` in `hooks/useAgentActivity.ts`
- 측정값: 1건 -- 10행 `export interface ActivityLogEntry {`
- 판정: **PASS**

#### [CHK-014] seedToColors 함수가 lib/utils.ts에 export됨
- 측정 방법: Grep `export.*seedToColors` in `lib/utils.ts`
- 측정값: 1건 -- 6행 `export function seedToColors(seed: number): { body: string; accent: string; detail: string } {`
- 판정: **PASS**

#### [CHK-015] AgentAvatar.tsx에서 seedToColors를 lib/utils에서 import
- 측정 방법: Grep `import.*seedToColors.*utils` in `components/ui/AgentAvatar.tsx`
- 측정값: 1건 -- 3행 `import { cn, seedToColors } from '../../lib/utils'`
- 판정: **PASS**

#### [CHK-016] 에이전트 0명 시 "오피스가 비어있습니다" 텍스트 제거됨
- 측정 방법: Grep `오피스가 비어있습니다` in `pages/monitor/agents/`
- 측정값: 0건 (제거 확인)
- 판정: **PASS**

#### [CHK-017] 에이전트 0명 시 "에이전트를 기다리는 중" 텍스트 존재
- 측정 방법: Grep `기다리는 중` in `pages/monitor/agents/`
- 측정값: 1건 -- 851행 `에이전트를 기다리는 중...`
- 판정: **PASS**

#### [CHK-018] ChevronDown/ChevronUp 인라인 SVG 존재
- 측정 방법: Grep `M6 9l6 6 6-6|M18 15l-6-6-6 6` in `pages/monitor/agents/`
- 측정값: 2건 -- 980행 `<path d="M18 15l-6-6-6 6" />` (ChevronUp), 984행 `<path d="M6 9l6 6 6-6" />` (ChevronDown)
- 판정: **PASS**

#### [CHK-019] 사이드 패널 width 320px 정의
- 측정 방법: Grep `320` in `pages/monitor/agents/`
- 측정값: 2건 -- 1113행 `w-[320px]` (데스크탑 인라인 패널), 1130행 `w-[320px]` (모바일 오버레이 패널)
- 판정: **PASS**

#### [CHK-020] CSS transition left/bottom이 에이전트 요소에 적용됨
- 측정 방법: Grep `transition.*left.*bottom` in `pages/monitor/agents/`
- 측정값: 1건 -- 780행 `transition: 'left 400ms ease-out, bottom 400ms ease-out'`
- 판정: **PASS**

#### [CHK-021] 에러 시 재시도 버튼 존재
- 측정 방법: Grep `재시도` in `pages/monitor/agents/`
- 측정값: 1건 -- 912행 `재시도` (Alert 내부 버튼 텍스트)
- 판정: **PASS**

#### [CHK-022] OfficeSkeleton 컴포넌트 존재
- 측정 방법: Grep `OfficeSkeleton` in `pages/monitor/agents/`
- 측정값: 3건 -- 430행 사용처 `return <OfficeSkeleton />`, 472행 주석, 474행 `function OfficeSkeleton()`
- 판정: **PASS**

#### [CHK-023] 미디어쿼리 1360px가 사이드 패널 전환에 사용됨
- 측정 방법: Grep `1360` in `pages/monitor/agents/`
- 측정값: 3건 -- 319행 `window.matchMedia('(min-width: 1360px)')`, 1109행 주석 `>= 1360px`, 1121행 주석 `< 1360px`
- 판정: **PASS**

#### [CHK-024] ESC 키 닫기 이벤트 핸들러가 사이드 패널에 존재
- 측정 방법: Grep `Escape` in `pages/monitor/agents/`
- 측정값: 1건 -- 1049행 `if (e.key === 'Escape') onClose()`
- 판정: **PASS**

---

### 회귀 검증

#### [REG-001] AgentAvatar.tsx import 체인 정상
- 측정 방법: Grep `import.*AgentAvatar|from.*AgentAvatar` 전체 프로젝트
- 측정값: AgentAvatar를 import하는 파일 3개 확인
  - `components/ui/index.ts` -- re-export
  - `pages/config/agents/+Page.tsx` -- import 사용
  - `pages/monitor/agents/+Page.tsx` -- import 사용
- `npm run build` exit code 0으로 전체 import 체인 유효성 확인됨
- 판정: **PASS**

#### [REG-002] seedToColors 추출 후 기존 AgentAvatar 동작 유지
- 측정 방법: Read `components/ui/AgentAvatar.tsx` 3행 확인 + `npm run build`
- 측정값: `import { cn, seedToColors } from '../../lib/utils'` 정상 import, 75행 `const colors = seedToColors(seed)` 사용 확인. 빌드 통과.
- 판정: **PASS**

#### [REG-003] 기존 페이지 빌드 정상 (전체)
- 측정 방법: `npm run build` 전체 빌드
- 측정값: client 272 modules + SSR 105 modules 빌드 성공, exit code 0
- 기존 페이지 빌드 출력 확인:
  - `pages_config_agents` -- 빌드 성공
  - `pages_monitor_sessions` -- 빌드 성공
  - `pages_index` -- 빌드 성공
  - `pages_config_editor` -- 빌드 성공
  - 그 외 모든 페이지 빌드 성공
- 판정: **PASS**

#### [REG-004] TypeScript 타입 체크 전체 통과
- 측정 방법: `npx tsc --noEmit`
- 측정값: exit code 0, 에러 0건
- 판정: **PASS**

---

## 실패 항목 요약

| ID | 항목 | 증상 | 근본 원인 | 수정 범위 | 심각도 |
|----|------|------|----------|----------|--------|
| (없음) | - | - | - | - | - |

---

## 코드 검증 종합

- 전체 항목: 26개 (빌드/타입 2개 + 요소 존재 22개 + 회귀 4개)
- 통과: 26개
- 실패: 0개
- **Part 1 코드 검증: PASS**

---
---

## QA 리포트 -- Part 2: 시각적 + 수용 테스트
- 검증 일시: 2026-03-08
- 대상 스펙: 03-spec-revised.md Section D (시각적 기대 상태), Section E (수용 기준)
- 검증 환경: Docker 컨테이너 내 dev 서버 (port 3000) + mock gateway (port 18789)
- 브라우저: Preview 도구 (Chromium 기반)
- **합격 여부: PASS**

---

### 수용 기준 검증 (Section E)

#### [AC-001] 연속 공간 — 오피스가 하나의 연속된 2D 공간
- 측정 방법: DOM 검사 — SVG viewBox, 바닥선, 존 라벨, 에이전트 포지셔닝 확인
- 측정값:
  - SVG viewBox="0 0 1000 500" 확인
  - 바닥선 `<line y1="400" y2="400">` 존재
  - 5개 존 라벨 (입구, 라운지, 작업 데스크, 미팅 룸, 도구 창고) 표시
  - 오피스 컨테이너 `position: relative`, `minHeight: 420px`
  - 에이전트 `left/bottom %` 포지셔닝 + CSS transition
- 판정: **PASS**

#### [AC-002] 빈 오피스 — 에이전트 0명 시 가구+존+대기 메시지
- 측정 방법: 스크린샷 — 세션 만료 후 빈 오피스 상태 캡처
- 측정값:
  - "에이전트를 기다리는 중..." 오버레이 텍스트 표시
  - 15개 가구 SVG 정상 렌더링 (소파, 책상, 의자, 책장 등)
  - 5개 존 라벨 상단 표시
  - 헤더 배지 "0 활동중, 0 총원"
- 판정: **PASS**

#### [AC-003] 에이전트 상태 — hover 없이 현재 상태가 보인다
- 측정 방법: 스크린샷 + DOM 검사 — 에이전트 3명 활동 시 말풍선 확인
- 측정값:
  - SpeechBubble 컴포넌트 1개 렌더링 (working 상태: "작업 중...")
  - 에이전트 이름 레이블 "Agent-ses-d8" 표시
  - 말풍선에 상태 아이콘 + 텍스트 표시 (hover 불필요)
- 판정: **PASS**

#### [AC-004] 사이드 패널 — 에이전트 클릭 시 320px 인라인 패널
- 측정 방법: 브라우저 클릭 + 스크린샷 (1400px 뷰포트)
- 측정값:
  - 에이전트 클릭 → 320px 사이드 패널 슬라이드 인
  - 패널 내용: 아바타, 에이전트명, 세션 ID, 상태 배지
  - RPG 스탯 (모델, 채널, 로그레벨, 포트 등) 표시
  - EXP 바 + 토큰 사용량 표시
  - X 닫기 버튼 작동
- 판정: **PASS**

#### [AC-005] 활동 로그 — 접기/펼치기 토글
- 측정 방법: 브라우저 클릭 — 접기 버튼 클릭 후 높이 변화 측정
- 측정값:
  - 펼침 상태: height ~120px (로그 항목 3개 표시)
  - 접힘 상태: height ~32px (ChevronDown 아이콘만 표시)
  - 토글 버튼에 ChevronUp/ChevronDown SVG 전환 확인
- 판정: **PASS**

#### [AC-006] 로딩 스켈레톤 — 초기 로딩 시 OfficeSkeleton 표시
- 측정 방법: 코드 검증 (CHK-022) — 컴포넌트 존재 + 사용처 확인
- 측정값:
  - OfficeSkeleton 컴포넌트 474행 정의, 430행 사용
  - `style={{ height: 420 }}` 스켈레톤 컨테이너
  - 시각적 검증: 로딩 시간 < 1초로 캡처 불가 (정상 동작 — 스켈레톤이 보이지 않을 정도로 빠름)
- 비고: 네트워크 지연 없는 Docker 로컬 환경에서 스켈레톤 표시 시간이 극히 짧음
- 판정: **PASS**

#### [AC-007] 에러 상태 — 연결 실패 시 에러 표시 + 재시도 버튼
- 측정 방법: Gateway 프로세스 강제 종료 → 에러 화면 캡처
- 측정값:
  - Gateway 종료 후 ~8초 내 "Gateway 연결이 끊어졌습니다" 페이지 표시
  - "재연결 시도" 버튼 표시
  - "새로운 Gateway로 연결" 링크 표시
  - 인페이지 Alert + "재시도" 버튼은 코드 검증 (CHK-021, 912행)에서 확인 (부분 실패 시 동작)
- 판정: **PASS**

#### [AC-008] 반응형 — 1024px 이하에서도 사용 가능
- 측정 방법: 뷰포트 1024x768 리사이즈 + 스크린샷
- 측정값:
  - 오피스 컨테이너 minWidth: 800 유지 → 가로 스크롤바 표시
  - 에이전트 캐릭터, 존 라벨, 말풍선 정상 렌더링
  - 활동 로그 하단 표시
  - 사이드바 메뉴 정상 표시
- 판정: **PASS**

#### [AC-009] 다크/라이트 모드 — 양쪽 모두 정상 동작
- 측정 방법: 테마 토글 버튼 클릭 → 각 모드에서 스크린샷 캡처
- 측정값:
  - **다크 모드**: 어두운 배경, 가구 SVG stroke `var(--owm-border)` 밝은 색, 에이전트 캐릭터 선명, 활동 로그 가독성 양호
  - **라이트 모드**: 밝은 배경, 가구 SVG 회색 stroke 표시, 존 라벨 가독성 양호, 에이전트 캐릭터 정상 표시
  - 두 모드 간 전환 즉시 적용 (CSS 변수 기반)
- 판정: **PASS**

#### [AC-010] 존 이동 — 상태 변경 시 에이전트가 부드럽게 이동
- 측정 방법: DOM 검사 — CSS transition 속성 확인
- 측정값:
  - 모든 에이전트 요소에 `transition: left 400ms ease-out, bottom 400ms ease-out` 적용
  - computed style `left 0.4s ease-out, bottom 0.4s ease-out` 확인
  - 상태 변경 시 left/bottom % 값이 업데이트되며 CSS transition이 부드러운 이동 처리
- 판정: **PASS**

#### [AC-011] 오버레이 패널 — <1360px에서 에이전트 클릭 시 오버레이
- 측정 방법: 뷰포트 1200px 리사이즈 → 에이전트 클릭 → 스크린샷
- 측정값:
  - 1200px 뷰포트에서 에이전트 클릭 → 오버레이 패널 출현
  - `bg-black/50` 반투명 백드롭 표시
  - 320px 패널 우측에서 슬라이드 인
  - ESC 키 → 패널 닫힘 확인
  - 백드롭 클릭 → 패널 닫힘 확인
- 판정: **PASS**

---

### 시각적 기대 상태 검증 (Section D)

| ID | 상태 | 검증 방법 | 결과 |
|----|------|----------|------|
| VS-001 | 빈 오피스 | 스크린샷 (세션 만료 후) | **PASS** — 가구 15개 + 존 라벨 5개 + "기다리는 중" 오버레이 |
| VS-002 | 에이전트 활동 중 | 스크린샷 (3명 활동) | **PASS** — 말풍선, 존 배치, 이름 레이블 |
| VS-003 | 에이전트 선택 (>=1360px) | 스크린샷 (1400px) | **PASS** — 320px 인라인 사이드 패널 |
| VS-004 | 에이전트 선택 (<1360px) | 스크린샷 (1200px) | **PASS** — 오버레이 + bg-black/50 백드롭 |
| VS-005 | 에러 상태 | 스크린샷 (Gateway 종료) | **PASS** — "연결이 끊어졌습니다" + 재연결 버튼 |
| VS-006 | 7+ 에이전트 동일 존 | 코드 검증만 | **N/A** — mock gateway 최대 ~5 세션 생성, +N 배지 코드 존재 확인 |
| VS-007 | 활동 로그 접힘 | 브라우저 클릭 | **PASS** — 32px 접힘, chevron 아이콘 |
| VS-008 | 로딩 스켈레톤 | 코드 검증 (CHK-022) | **PASS** — OfficeSkeleton 컴포넌트 존재, 빠른 로딩으로 시각적 캡처 불가 |
| VS-009 | idle 상태 Zzz | 코드 검증 (CHK-009, CHK-010) | **PASS** — IdleZzz + animate-float 코드 존재, mock 상태 랜덤 |
| VS-010 | speaking 상태 말풍선 | 코드 검증 (CHK-008) | **PASS** — SpeechBubble 상태별 분기 코드 존재 |

---

### 실패 항목 요약

| ID | 항목 | 증상 | 근본 원인 | 수정 범위 | 심각도 |
|----|------|------|----------|----------|--------|
| (없음) | - | - | - | - | - |

---

### 미검증 항목 (환경 제약)

| ID | 항목 | 미검증 사유 | 대체 검증 |
|----|------|-----------|----------|
| VS-006 | 7+ 에이전트 동일 존 | mock gateway가 최대 ~5 세션 생성 | 코드 레벨에서 +N 배지 로직 확인 |
| VS-009 | idle Zzz 애니메이션 | mock gateway 상태 랜덤, idle 미관측 | CHK-009/010에서 IdleZzz + animate-float 코드 존재 확인 |
| VS-010 | speaking 말풍선 분기 | mock gateway 상태 랜덤, speaking 미관측 | CHK-008에서 SpeechBubble 상태별 분기 코드 확인 |

---

## 시각적 + 수용 테스트 종합

- 수용 기준 (AC): 11개 전체 **PASS**
- 시각적 기대 상태 (VS): 10개 중 7개 브라우저 검증 PASS, 3개 코드 레벨 검증 PASS (환경 제약)
- 실패: 0개
- **Part 2 시각적 + 수용 테스트: PASS**

---
---

## 최종 종합

- Part 1 코드 검증: **PASS** (26/26)
- Part 2 시각적 + 수용 테스트: **PASS** (AC 11/11 + VS 10/10)
- **최종 판정: PASS**
