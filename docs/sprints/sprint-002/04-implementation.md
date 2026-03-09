# Sprint-002: 04-implementation.md -- 구현 로그

## 구현 요약
- 변경 파일: 4개
- 신규 파일: 0개
- 삭제 파일: 0개

## 변경 내역

### [IMP-001] lib/utils.ts
- 변경 이유: CRIT-004 반영 -- seedToColors 함수를 AgentAvatar.tsx에서 추출하여 공유 유틸로 export
- 변경 내용: `export function seedToColors(seed: number)` 함수 추가. HSL 기반 결정론적 색상 생성. ActivityLogFeed와 AgentAvatar 양쪽에서 import하여 사용.

### [IMP-002] components/ui/AgentAvatar.tsx
- 변경 이유: CRIT-004 반영 -- seedToColors를 lib/utils에서 import하도록 변경
- 변경 내용: 로컬 `seedToColors` 함수 제거, `import { cn, seedToColors } from '../../lib/utils'`로 변경. 기능 동작은 동일.

### [IMP-003] hooks/useAgentActivity.ts
- 변경 이유: CRIT-001 반영 -- 활동 로그 데이터 소스 구현
- 변경 내용:
  - `ActivityLogEntry` 타입 추가 및 export (id, timestamp, agentId, agentName, avatarSeed, type, message)
  - `activityLogs` 상태 배열 추가 (`useState<ActivityLogEntry[]>([])`)
  - `onMessage` 콜백 내 session.started/updated/ended 이벤트 발생 시 로그 push 로직 추가
  - 최대 50건 FIFO 유지
  - 반환 객체에 `activityLogs` 추가

### [IMP-004] pages/monitor/agents/+Page.tsx
- 변경 이유: F-001~F-010 전체 구현 -- 싱글 플로어 오피스 UI 전면 재작성
- 변경 내용:
  - **F-001**: grid 레이아웃 제거, position:relative 오피스 컨테이너로 대체. SVG viewBox 0 0 1000 500 배경 (벽면, 바닥, 바닥선, 존 구분선). 5개 존 가로 배치. z-index 레이어 구조 (0/10/20/30/40/50).
  - **F-002**: 15종 가구 인라인 SVG, React.memo 래핑, position:absolute % 좌표 배치. FURNITURE_ITEMS 상수 배열로 데이터 정의.
  - **F-003**: 에이전트 캐릭터 absolute 배치, 존별 startLeft/stepLeft/bottom 좌표 계산. transition: left 400ms, bottom 400ms 슬라이딩 이동. 존당 최대 6명 표시, 7명 이상 +N 뱃지 (Tooltip + Badge 재사용).
  - **F-004**: SpeechBubble 컴포넌트 (working/speaking/tool_calling/error 상태별 인라인 SVG 아이콘 + 메시지). IdleZzz 컴포넌트 (animate-float 클래스). 말풍선 tail CSS border trick.
  - **F-005**: ZoneLabel 컴포넌트 5개 (입구/라운지/작업 데스크/미팅 룸/도구 창고). 인라인 SVG 14x14 아이콘. Badge 인원수 뱃지.
  - **F-006**: ActivityLogFeed 컴포넌트 (접기/펼치기 토글, ChevronDown/Up 인라인 SVG). LogEntry 컴포넌트 (seedToColors 기반 에이전트명 색상). 자동 스크롤. 빈 상태 안내 메시지.
  - **F-007**: OfficeHeader 수정 (제목, Badge 3개, 새로고침 Button, OfficeClock). OfficeClock (HH:MM, 1분 간격 갱신). 에러 배너 (Alert variant="error" + 재시도 Button, oRetry=refresh).
  - **F-008**: OfficeSkeleton 컴포넌트 (420px, 바닥선 animate-pulse, 5개 존 블록 stagger, 로그 영역 스켈레톤).
  - **F-009**: EmptyOfficeOverlay 컴포넌트 (desk 존 중앙 반투명 안내 패널). 기존 "오피스가 비어있습니다" Card 제거.
  - **F-010**: AgentSidePanel (320px, 슬라이드 인). useIsWideScreen 훅 (1360px 미디어쿼리). 데스크탑: flex 인라인. 모바일: fixed 오버레이 + backdrop. ESC 키 닫기. 세로 레이아웃 (아바타 중앙, 스탯 2열 grid, 경험치 바).

### [IMP-005] styles/global.css
- 변경 이유: F-004 말풍선 등장 애니메이션 CSS 추가
- 변경 내용: `@keyframes speech-bubble-in` 및 `.animate-speech-bubble-in` 클래스 추가. translateX(-50%) translateY 기반 fade-in-up 애니메이션 200ms.

## 빌드 결과
- `npm run build`: PASS (exit code 0, built in 996ms)
- `npx tsc --noEmit`: PASS (에러 0개)

## 자기 점검
- [x] `npm run build` 성공 (exit code 0)
- [x] `npx tsc --noEmit` 에러 0개
- [x] 스펙에 없는 파일을 수정하지 않았는가 -- 변경 파일은 모두 스펙에 명시된 대상 파일

## 스펙 검증 체크리스트 (Section C 기준)
- [x] `grid grid-cols-1 lg:grid-cols-3` 클래스 제거됨 (0건)
- [x] minHeight: 420 스타일 존재 (2건)
- [x] SVG viewBox="0 0 1000 500" 존재 (1건)
- [x] 바닥선 y1="400" y2="400" 존재 (1건)
- [x] 가구 viewBox 15개 이상 존재 (32건 -- 가구 15 + 존 아이콘 5 + 말풍선 아이콘 4 + 배경 1 등)
- [x] SpeechBubble 함수 존재 (1건)
- [x] IdleZzz / "Zzz" 텍스트 존재 (5건)
- [x] animate-float 클래스 사용됨 (1건)
- [x] ActivityLogFeed 존재 (3건)
- [x] activityLogs 반환값 존재 (2건)
- [x] ActivityLogEntry export됨 (1건)
- [x] seedToColors lib/utils.ts에 export (1건)
- [x] AgentAvatar.tsx에서 seedToColors import from utils (1건)
- [x] "오피스가 비어있습니다" 텍스트 제거됨 (0건)
- [x] "기다리는 중" 텍스트 존재 (1건)
- [x] ChevronDown/Up SVG path 존재 (M6 9l6 6 6-6: 1건, M18 15l-6-6-6 6: 1건)
- [x] 사이드 패널 320px 정의 (2건)
- [x] transition 속성 적용 (7건)
- [x] "재시도" 텍스트 존재 (1건)
- [x] OfficeSkeleton 존재 (3건)
- [x] 미디어쿼리 1360px 사용 (3건)
- [x] ESC 키 핸들러 존재 (1건)
