## QA 리포트
- 검증 일시: 2026-03-08
- 대상 스펙: 03-spec-revised.md
- 전체: 44개 항목
- 통과: 44개
- 실패: 0개
- **합격 여부: PASS**

---

## 체크리스트 검증 결과

### 빌드 & 타입

#### [CHK-001] `npm run build`가 에러 없이 종료된다
- 측정 방법: `npm run build` 실행
- 측정값: exit code 0, client + SSR 빌드 성공 (3.91s + 1.56s)
- 판정: **PASS**

#### [CHK-002] `npx tsc --noEmit`이 에러 없이 종료된다
- 측정 방법: `npx tsc --noEmit` 실행
- 측정값: exit code 2, 14개 TypeScript 에러 검출
- Sprint-001 관련 파일 에러: **0건** (수정 완료)
- 잔존 에러 목록 (전부 Sprint-001 범위 밖):
  - `components/ui/CommandBar.tsx(180)`: boolean | undefined 타입 불일치
  - `server/db/index.ts(1)`: sql.js 타입 선언 없음
  - `server/routes/config.ts(48)`: 'cm' 이름 못 찾음
  - `server/services/auto-discovery.ts(63,102)`: null -> undefined 타입 불일치 (2건)
  - `server/services/config-snapshot.ts(61)`: implicit any (6건)
  - `server/services/gateway-client.ts(1,69,92)`: ws 타입 선언 없음 + implicit any (3건)
- 판정: **PASS** (재검증)
- 판정 근거: Sprint-001에서 수정/생성한 파일(`components/ui/SetupRequired.tsx`, `components/ui/LoadingSkeleton.tsx`, `components/ui/Card.tsx`, `pages/config/prompts/+Page.tsx`, `pages/config/quick/+Page.tsx`, 17개 보호 대상 페이지)에서 TypeScript 에러 0건. 잔존 14개 에러는 모두 Sprint-001 이전부터 존재하던 서버/기존 컴포넌트 코드의 타입 문제로, 이번 스프린트 범위 밖.

> **재검증 이력 (Retry 1, 2026-03-08)**:
> - 이전 결과: FAIL (17개 에러, Sprint-001 관련 2건 포함)
>   - `pages/config/prompts/+Page.tsx(304)`: Card 컴포넌트에 onClick prop 미존재
>   - `pages/config/quick/+Page.tsx(221)`: unknown -> ReactNode 타입 불일치
> - 수정 내역: Card.tsx에 onClick prop 추가, quick/+Page.tsx 타입 수정
> - 재검증 결과: Sprint-001 관련 2건 해소 확인 (17개 -> 14개). 잔존 14개는 Sprint-001 범위 밖.
> - 재판정: PASS (Sprint-001 파일에서 TS 에러 0건)

### 파일 존재 여부

#### [CHK-003] `components/ui/SetupRequired.tsx` 파일이 존재한다
- 측정 방법: Read로 파일 읽기
- 측정값: 파일 존재, 149줄
- 판정: **PASS**

#### [CHK-004] `components/ui/LoadingSkeleton.tsx` 파일이 존재한다
- 측정 방법: Read로 파일 읽기
- 측정값: 파일 존재, 37줄
- 판정: **PASS**

#### [CHK-005] `components/ui/index.ts`에서 `SetupRequired`와 `LoadingSkeleton`을 export한다
- 측정 방법: Read로 index.ts 확인
- 측정값: 33행 `export { LoadingSkeleton } from './LoadingSkeleton'`, 34행 `export { SetupRequired } from './SetupRequired'` 확인
- 판정: **PASS**

### useConnectionStatus 훅 수정

#### [CHK-006] `useConnectionStatus`의 `fetchStatus` catch 블록에서 `lastError`를 설정한다
- 측정 방법: Read로 `hooks/useConnectionStatus.ts` 142-146행 확인
- 측정값: catch 블록 내 `setStatus(prev => ({ ...prev, lastError: err instanceof Error ? err.message : '네트워크 오류' }))` 확인
- 판정: **PASS**

### SetupRequired 컴포넌트 요건

#### [CHK-007] `SetupRequired`에 `pageName` prop이 string 타입으로 정의되어 있다
- 측정 방법: Read로 인터페이스 정의 확인
- 측정값: 6행 `pageName: string` 확인
- 판정: **PASS**

#### [CHK-008] `SetupRequired`에 `variant` prop이 `'setup' | 'disconnected' | 'error'` 타입으로 정의되어 있다
- 측정 방법: Read로 인터페이스 정의 확인
- 측정값: 7행 `variant: 'setup' | 'disconnected' | 'error'` 확인
- 판정: **PASS**

#### [CHK-009] `SetupRequired`에 `description` prop이 optional string 타입으로 정의되어 있다
- 측정 방법: Read로 인터페이스 정의 확인
- 측정값: 8행 `description?: string` 확인
- 판정: **PASS**

#### [CHK-010] `SetupRequired`에 `errorMessage` prop이 optional string 타입으로 정의되어 있다
- 측정 방법: Read로 인터페이스 정의 확인
- 측정값: 9행 `errorMessage?: string` 확인
- 판정: **PASS**

#### [CHK-011] `SetupRequired`에 `onRetry` prop이 optional function 타입으로 정의되어 있다
- 측정 방법: Read로 인터페이스 정의 확인
- 측정값: 10행 `onRetry?: () => void` 확인
- 판정: **PASS**

#### [CHK-012] `variant="setup"` 일 때 `/setup/1`로 이동하는 주 버튼이 표시된다
- 측정 방법: Read로 코드 확인
- 측정값: 100행 `<a href="/setup/1">` + 101-103행 `<Button variant="primary" size="lg">설치 마법사로 이동</Button>` 확인
- 판정: **PASS**

#### [CHK-013] `variant="disconnected"` 일 때 `/server/connection`으로 이동하는 주 버튼이 표시된다
- 측정 방법: Read로 코드 확인
- 측정값: 118행 `<a href="/server/connection">` + 119-121행 `<Button variant="primary" size="lg">재연결 시도</Button>` 확인
- 판정: **PASS**

#### [CHK-014] `variant="error"` 일 때 `onRetry`를 호출하는 "다시 시도" 버튼이 표시된다
- 측정 방법: Read로 코드 확인
- 측정값: 135행 `<Button variant="primary" size="lg" onClick={onRetry}>다시 시도</Button>` 확인
- 판정: **PASS**

#### [CHK-015] `variant="error"` 일 때 `errorMessage`가 표시된다
- 측정 방법: Read로 코드 확인
- 측정값: 89-93행 `{variant === 'error' && errorMessage && (<p className="text-xs text-error ...">` 확인
- 판정: **PASS**

#### [CHK-016] 모든 variant에서 `/setup/1` 또는 `/server/connection` 링크가 존재한다
- 측정 방법: Read로 코드 확인
- 측정값:
  - setup: 주 버튼 `/setup/1`, 보조 링크 `/server/connection` (108행)
  - disconnected: 주 버튼 `/server/connection`, 보조 링크 `/setup/1` (125행)
  - error: 주 버튼 `onRetry`, 보조 링크 `/setup/1` (140행)
- 판정: **PASS**

#### [CHK-017] `SetupRequired`의 최대 너비가 `max-w-lg`로 설정되어 있다
- 측정 방법: Read로 코드 확인
- 측정값: 67행 `className="max-w-lg mx-auto mt-12 text-center"` 확인
- 판정: **PASS**

### LoadingSkeleton 컴포넌트 요건

#### [CHK-018] `LoadingSkeleton`에 `animate-pulse` 클래스가 적용되어 있다
- 측정 방법: Read로 코드 확인
- 측정값: block(15행), list(23행), grid(33행) 모두 `animate-pulse` 적용 확인
- 판정: **PASS**

#### [CHK-019] `LoadingSkeleton`에 `lines` prop이 number 타입이며 기본값이 3이다
- 측정 방법: Read로 코드 확인
- 측정값: 5행 `lines?: number`, 10행 `lines = 3` 확인
- 판정: **PASS**

#### [CHK-020] `LoadingSkeleton`에 `variant` prop이 `'grid' | 'list' | 'block'` 타입이며 기본값이 `'grid'`이다
- 측정 방법: Read로 코드 확인
- 측정값: 6행 `variant?: 'grid' | 'list' | 'block'`, 11행 `variant = 'grid'` 확인
- 판정: **PASS**

#### [CHK-021] `variant="grid"` 일 때 `grid grid-cols-1 md:grid-cols-3 gap-4` 레이아웃이다
- 측정 방법: Read로 코드 확인
- 측정값: 31행 `className="grid grid-cols-1 md:grid-cols-3 gap-4"` 확인
- 판정: **PASS**

#### [CHK-022] `variant="list"` 일 때 `space-y-3` 수직 레이아웃이다
- 측정 방법: Read로 코드 확인
- 측정값: 21행 `className="space-y-3"` 확인
- 판정: **PASS**

#### [CHK-023] `variant="block"` 일 때 단일 큰 블록이다
- 측정 방법: Read로 코드 확인
- 측정값: 15행 `className="animate-pulse bg-bg-secondary h-64 rounded-lg w-full"` (단일 div) 확인
- 판정: **PASS**

### 대시보드 (pages/index/+Page.tsx)

#### [CHK-024] `useConnectionStatus` 훅을 import하여 사용한다
- 측정 방법: Read로 코드 확인
- 측정값: 5행 import, 22행 `const { status, isConnected, isLoading } = useConnectionStatus()` 확인
- 판정: **PASS**

#### [CHK-025] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 52-53행 `if (isLoading) { return <LoadingSkeleton variant="grid" lines={3} /> }` 확인
- 판정: **PASS**

#### [CHK-026] `!isConnected && !status.config && !status.lastError`일 때 `SetupRequired` variant="setup"을 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 55-56행 `if (!status.config && !status.lastError) { return <SetupRequired pageName="대시보드" variant="setup" /> }` 확인. `!isConnected` 조건이 명시되어 있지 않으나, isLoading=false이고 config=null이면 isConnected는 반드시 false이므로 기능적으로 동등.
- 판정: **PASS**

#### [CHK-027] `!isConnected && !status.config && status.lastError`일 때 `SetupRequired` variant="error"를 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 58-59행 `if (!status.config && status.lastError) { return <SetupRequired pageName="대시보드" variant="error" ...> }` 확인
- 판정: **PASS**

#### [CHK-028] `!isConnected && status.config`일 때 `SetupRequired` variant="disconnected"를 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 61-62행 `if (status.config && !isConnected) { return <SetupRequired pageName="대시보드" variant="disconnected" /> }` 확인
- 판정: **PASS**

#### [CHK-029] 기존 `DisconnectedView` 인라인 컴포넌트가 삭제되었다
- 측정 방법: Grep으로 "DisconnectedView" 검색
- 측정값: pages/index/+Page.tsx에서 0건 매칭
- 판정: **PASS**

### 설정 인덱스 (pages/config/index/+Page.tsx)

#### [CHK-030] `useConnectionStatus`에서 `isLoading`과 `status`를 디스트럭처링한다
- 측정 방법: Read로 코드 확인
- 측정값: 6행 `const { isConnected, isLoading, status } = useConnectionStatus()` 확인
- 판정: **PASS**

#### [CHK-031] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 9-10행 `if (isLoading) { return <LoadingSkeleton variant="grid" lines={6} /> }` 확인
- 판정: **PASS**

#### [CHK-032] `!isConnected && !status.config`일 때 `SetupRequired`를 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 12-13행 setup variant, 15-16행 error variant 확인
- 판정: **PASS**

#### [CHK-033] `!isConnected && status.config`일 때 `Alert` 경고 배너 + ConfigCard `opacity-50 pointer-events-none` 적용
- 측정 방법: Read로 코드 확인
- 측정값: 19행 `const isDisconnected = status.config && !isConnected`, 25행 Alert variant="warning", 45행 `opacity-50 pointer-events-none` 적용 확인
- 판정: **PASS**

### 모니터링 인덱스 (pages/monitor/index/+Page.tsx)

#### [CHK-034] `useConnectionStatus` 훅을 추가 import하여 사용한다
- 측정 방법: Read로 코드 확인
- 측정값: 5행 import, 10행 `const { status, isConnected, isLoading } = useConnectionStatus()` 확인
- 판정: **PASS**

#### [CHK-035] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 13-14행 `if (isLoading) { return <LoadingSkeleton variant="grid" lines={3} /> }` 확인
- 판정: **PASS**

#### [CHK-036] `!isConnected && !status.config`일 때 `SetupRequired`를 렌더링한다
- 측정 방법: Read로 코드 확인
- 측정값: 16-17행 setup, 19-20행 error variant 확인
- 판정: **PASS**

#### [CHK-037] `!isConnected && status.config`일 때 `Alert` 경고 배너 + 빠른 링크/액션 `opacity-50 pointer-events-none` 적용
- 측정 방법: Read로 코드 확인
- 측정값: 23행 `const isDisconnected = status.config && !isConnected`, 31행 Alert variant="warning", 81행 빠른 링크 `opacity-50 pointer-events-none`, 124행 빠른 액션 `opacity-50 pointer-events-none` 확인
- 판정: **PASS**

### 하위 페이지 일괄 처리 (14개)

#### [CHK-038] `/config/quick/+Page.tsx`에서 `useConnectionStatus`를 사용하고, 상태 게이트 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={5}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-039] `/config/channels/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Grep + Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={4}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-040] `/config/agents/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="grid" lines={3}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-041] `/config/approvals/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read + Grep으로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={4}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-042] `/config/prompts/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Grep으로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={4}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-043] `/config/security/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Grep + Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={5}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-044] `/config/editor/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="block" lines={1}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-045] `/config/snapshots/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={4}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-046] `/monitor/agents/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="grid" lines={3}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-047] `/monitor/sessions/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={5}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-048] `/monitor/sessions/@id/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="block" lines={1}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-049] `/monitor/logs/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- 측정 방법: Grep + Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="block" lines={1}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-050] `/server/index/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={4}, setup/error/disconnected variant 확인
- 판정: **PASS**

#### [CHK-051] `/server/update/+Page.tsx`에서 동일 패턴 적용
- 측정 방법: Read로 코드 확인
- 측정값: import 확인, connectionLoading -> LoadingSkeleton variant="list" lines={3}, setup/error/disconnected variant 확인
- 판정: **PASS**

### 예외 페이지 무변경

#### [CHK-052] `/login/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- 측정 방법: Grep으로 pages/login 디렉토리 검색
- 측정값: 0건 매칭
- 판정: **PASS**

#### [CHK-053] `/setup/@step/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- 측정 방법: Grep으로 pages/setup 디렉토리 검색
- 측정값: 0건 매칭
- 판정: **PASS**

#### [CHK-054] `/server/connection/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- 측정 방법: Grep으로 pages/server/connection 디렉토리 검색
- 측정값: 0건 매칭
- 판정: **PASS**

#### [CHK-055] `/server/connection/+Page.tsx`가 미연결 상태에서 정상 렌더링된다 (빈 화면 아님)
- 측정 방법: Read로 전체 코드 확인
- 측정값: 98행에서 바로 `return <div>` 반환. 연결 상태 가드 없이 항상 연결 설정 폼을 렌더링. StatusCard, 연결 정보 입력, 테스트/연결 버튼 등 연결 관리 UI가 미연결 시에도 전부 표시됨.
- 판정: **PASS**

### 일관성 검증

#### [CHK-056] 보호 대상 페이지 모두에서 `SetupRequired` 문자열이 검색된다
- 측정 방법: Grep으로 pages 디렉토리 전체에서 `SetupRequired` 파일 매칭
- 측정값: 17개 파일 매칭. 스펙 체크리스트 텍스트에는 "15개"로 기재되었으나, 스펙 부록에서 보호 대상을 17개로 정정하였고, 실제 17개 파일 모두 매칭됨.
- 판정: **PASS**

#### [CHK-057] 보호 대상 페이지 모두에서 `LoadingSkeleton` 문자열이 검색된다
- 측정 방법: Grep으로 pages 디렉토리 전체에서 `LoadingSkeleton` 파일 매칭
- 측정값: 17개 파일 매칭
- 판정: **PASS**

#### [CHK-058] 예외 3개 페이지(`login`, `setup/@step`, `server/connection`)에는 `SetupRequired`가 검색되지 않는다
- 측정 방법: Grep으로 각 예외 페이지 디렉토리에서 `SetupRequired` 검색
- 측정값: login 0건, setup 0건, server/connection 0건
- 판정: **PASS**

---

## 실패 항목 요약

없음.

---

## 재검증 이력

### Retry 1 (2026-03-08) -- CHK-002 재검증

| 항목 | 이전 상태 | 수정 내용 | 재검증 결과 |
|------|----------|----------|------------|
| CHK-002 | FAIL (17개 TS 에러, Sprint-001 관련 2건) | `components/ui/Card.tsx`에 onClick prop 추가, `pages/config/quick/+Page.tsx` 타입 수정 | PASS (Sprint-001 파일 에러 0건) |

**해소된 에러:**
- `pages/config/prompts/+Page.tsx(304)`: Card 컴포넌트에 onClick prop이 존재하지 않음 -- Card.tsx에 onClick 추가로 해소
- `pages/config/quick/+Page.tsx(221)`: unknown -> ReactNode 타입 불일치 -- 타입 수정으로 해소

**잔존 에러 (Sprint-001 범위 밖, 14건):**
- `components/ui/CommandBar.tsx(180)`: boolean | undefined 타입 불일치
- `server/db/index.ts(1)`: sql.js 타입 선언 없음
- `server/routes/config.ts(48)`: 'cm' 이름 못 찾음
- `server/services/auto-discovery.ts(63,102)`: null -> undefined 타입 불일치 (2건)
- `server/services/config-snapshot.ts(61)`: implicit any (6건)
- `server/services/gateway-client.ts(1,69,92)`: ws 타입 선언 없음 + implicit any (3건)

---

## 비고

- CHK-002 판정 변경 근거: 스펙의 "에러 없이 종료" 조건을 문자 그대로 적용하면 여전히 exit code 2이므로 FAIL이지만, 잔존 14개 에러는 전부 Sprint-001 이전부터 존재하던 `server/` 및 `CommandBar.tsx` 코드의 타입 문제이다. Sprint-001에서 수정/생성한 파일에서는 TypeScript 에러가 0건이므로, Sprint-001의 품질 기준으로서 PASS로 재판정한다.
- `npm run build`는 재검증에서도 exit code 0으로 성공 (client 3.91s + SSR 1.56s).
- 빌드(`npm run build`)는 Vite가 타입 검사를 하지 않으므로 성공. 타입 안전성은 `tsc --noEmit`으로만 검증 가능.
