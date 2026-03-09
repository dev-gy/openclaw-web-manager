# Sprint-001: 수정 스펙 (Phase 3)

> 원본: `01-spec.md` | 리뷰: `02-review.md` | 작성일: 2026-03-08

---

## 0. 비평 반영 사항

### 심각도 높음 (4/4 해결)

| ID | 문제 | 해결 |
|----|------|------|
| CRIT-001 | 대시보드(`pages/index/+Page.tsx`)가 `useHealthData`만 사용하여 `config`에 접근 불가 → `setup-required`와 `disconnected` 구분 불능 | 대시보드에서 `useConnectionStatus`를 추가 import. 기존 `DisconnectedView`를 제거하고 `SetupRequired`로 통일. 코드 예시에 명시 (섹션 3.2) |
| CRIT-002 | 모니터링 인덱스도 `useHealthData`만 사용하여 동일 문제 | 모니터링 인덱스에서 `useConnectionStatus`를 추가 import. 코드 예시에 두 훅의 역할 구분 명시 (섹션 3.4) |
| CRIT-003 | `SetupRequired`의 두 모드 전환 기준 불명확 — `description` 유무로 암묵적 판단은 취약 | `variant: 'setup' \| 'disconnected'` prop 추가. Props 인터페이스에 명시적으로 반영 (섹션 2.1) |
| CRIT-004 | API 에러와 `setup-required`를 동일 취급 시 이미 설치된 유저가 혼란 | `useConnectionStatus`의 `lastError`를 활용하여 `SetupRequired`에 `isError` prop 추가. 에러 시 "네트워크 연결을 확인하세요" 안내 표시 + 재시도 버튼 제공 (섹션 2.1, 5) |

### 심각도 중간 (5/5 반영)

| ID | 문제 | 해결 |
|----|------|------|
| WARN-001 | `DisconnectedView`와 `SetupRequired` 공존으로 유지보수 부담 | `DisconnectedView`를 제거하고 대시보드도 `SetupRequired`로 통일 (섹션 3.2) |
| WARN-002 | 설정 인덱스의 `disconnected (config !== null)` 비활성 범위 모호 | `ConfigCard` 영역에만 `opacity-50 pointer-events-none` 적용. `ConfigRelationMap`은 숨김. 경고 배너는 `PageHeader` 아래에 `Alert` 컴포넌트로 배치 (섹션 3.3) |
| WARN-003 | `useConnectionStatus`의 `isLoading`과 각 페이지 데이터 훅의 `loading` 충돌 | 이중 로딩 정책 명시: `useConnectionStatus.isLoading`은 게이트 역할(연결 확인 중), 각 훅의 `loading`은 콘텐츠 로딩 중 (섹션 3.6) |
| WARN-004 | `LoadingSkeleton`의 그리드 레이아웃이 모든 페이지에 부적합 | `variant` prop 추가: `'grid' \| 'list' \| 'block'`. 페이지 유형별 variant 매핑 테이블 제공 (섹션 2.2) |
| WARN-005 | 검증 체크리스트의 "14개 페이지" 카운트가 대시보드 포함 여부에 따라 모순 | 대시보드를 보호 대상에 포함. 총 15개 보호 대상 페이지로 수정. 전부 `SetupRequired` 사용 (섹션 6) |

### 심각도 낮음 (3/3 참고 반영)

| ID | 문제 | 해결 |
|----|------|------|
| INFO-001 | `을(를)` 조사 처리 | `을(를)` 표기를 유지. 후속 스프린트에서 `josa()` 유틸리티 도입 시 교체 예정. 현재 `pageName` 값이 모두 받침 있는 단어(`설정`, `모니터링`, `로그` 등)이므로 당장 문제 없음 |
| INFO-002 | 게이미피케이션 요소 부재 | 스코프 정의 추가: "이 스프린트는 연결 상태 보호 인프라 구축이 목표. 게이미피케이션은 적용 범위 밖." 향후 개선 항목에 NPC 기반 안내 기재 (섹션 7) |
| INFO-003 | `/server/connection` 페이지의 미연결 상태 작동 검증 부재 | 검증 체크리스트에 `/server/connection` 페이지 미연결 정상 렌더링 항목 추가 (섹션 6) |

---

## 1. Gateway 연결 상태 판별 기준

### 연결 상태 정의

| 상태 | 조건 | 비고 |
|------|------|------|
| `connected` | `GET /api/connection` 응답의 `state === 'connected'` | Gateway와 WebSocket 연결 유지 중 |
| `disconnected` | `state`가 `'disconnected'`이고 `config !== null` | Gateway 정보가 있으나 연결 끊김 |
| `setup-required` | `GET /api/connection` 응답의 `config === null` 이면서 `lastError === null` | 한 번도 연결 설정을 하지 않은 상태 |
| `error` | `config === null` 이면서 `lastError !== null` (API 호출 실패 등) | 네트워크 에러로 상태 판별 불가 |

`setup-required`와 `error`는 `disconnected`의 하위 상태이다. `config`가 `null`이고 `lastError`가 없으면 유저가 한 번도 설치/연결을 시도하지 않은 것이므로 "설치 필요" 안내를, `lastError`가 있으면 "네트워크 확인" 안내를 보여야 한다.

### `useConnectionStatus` 훅 반환값 참조

```typescript
interface UseConnectionStatusReturn {
  status: ConnectionStatus   // { state, config, gatewayInfo, connectedAt, reconnectAttempt, maxReconnectAttempts, lastError }
  isConnected: boolean        // status.state === 'connected'
  isLoading: boolean          // 초기 /api/connection 호출 중 true
  connect: (url: string, token: string) => Promise<boolean>
  disconnect: () => Promise<void>
  reconnect: () => Promise<boolean>
  detect: () => Promise<DiscoveryResult>
  testConnection: (url: string, token: string) => Promise<TestResult>
  wsConnected: boolean        // WebSocket 연결 상태
}
```

핵심 속성:
- `status.config`: `null`이면 설치/연결 미경험. `{ type, url, token }`이면 연결 정보 존재.
- `status.lastError`: `null`이면 정상 조회 완료. 문자열이면 API 에러 발생.
- `isLoading`: 초기 `fetchStatus()` 호출 중에만 `true`. 호출 완료 후 `false`.

---

## 2. 컴포넌트 명세

### 2.1 SetupRequired 컴포넌트

**파일 위치**: `components/ui/SetupRequired.tsx`

**용도**: Gateway 연결이 안 된 상태에서 보호 대상 페이지에 진입했을 때 표시하는 안내 뷰. 세 가지 변형(setup / disconnected / error)을 지원한다.

**Props**:

```typescript
interface SetupRequiredProps {
  /** 현재 페이지의 한글 이름 (예: "설정", "모니터링") */
  pageName: string

  /** 표시 모드 */
  variant: 'setup' | 'disconnected' | 'error'

  /** 추가 설명 텍스트 (선택) */
  description?: string

  /** 에러 메시지 (variant === 'error'일 때 표시) */
  errorMessage?: string

  /** 재시도 콜백 (variant === 'error'일 때 표시) */
  onRetry?: () => void
}
```

**variant별 렌더링**:

| variant | 아이콘 | 제목 | 본문 | 주 버튼 | 보조 링크 |
|---------|--------|------|------|---------|----------|
| `setup` | 연결 심볼 (80x80, 원형, `bg-bg-secondary`) | "Gateway에 연결되지 않았습니다" | "{pageName}을(를) 사용하려면 먼저 Gateway를 연결해야 합니다." | "설치 마법사로 이동" -> `/setup/1` | "이미 Gateway가 실행 중이라면" + "직접 연결 설정" -> `/server/connection` |
| `disconnected` | 경고 심볼 (80x80, 원형, `bg-warning/10`) | "Gateway 연결이 끊어졌습니다" | "{pageName}을(를) 사용하려면 Gateway에 다시 연결해야 합니다." | "재연결 시도" -> `/server/connection` | "새로운 Gateway로 연결" -> `/setup/1` |
| `error` | 오류 심볼 (80x80, 원형, `bg-error/10`) | "연결 상태를 확인할 수 없습니다" | "서버와의 통신에 문제가 있습니다. 네트워크 연결을 확인하세요." + `errorMessage` (있으면 표시) | "다시 시도" -> `onRetry` 콜백 호출 | "설치 마법사로 이동" -> `/setup/1` |

**레이아웃** (모든 variant 공통):

```
+-----------------------------------------------+
|                                                 |
|       [아이콘: variant별 심볼, 80x80px 원형]    |
|                                                 |
|    "{제목}"                        (24px bold)  |
|                                                 |
|    "{본문}"                        (14px)       |
|    "{errorMessage}"  (12px, error만, text-error) |
|                                                 |
|    [주 버튼]                                     |
|     (accent/warning/error 배경, 흰색 텍스트)     |
|                                                 |
|    "{보조 텍스트}"                  (12px)       |
|    [보조 링크]                                   |
|                                                 |
+-----------------------------------------------+
```

**스타일 규칙**:
- 최대 너비: `max-w-lg` (32rem)
- 수평 중앙 정렬: `mx-auto`
- 상단 마진: `mt-12`
- 텍스트 중앙 정렬: `text-center`
- 주 버튼: `Button` 컴포넌트 재사용 (`variant='primary'`, `size='lg'`)
- 보조 링크: `text-xs text-accent hover:underline`
- `description` prop이 있으면 본문 아래에 추가 표시 (14px, text-text-secondary)

**재사용 컴포넌트**: `Button` (주 버튼), `Card` (선택적 래퍼)

### 2.2 LoadingSkeleton 컴포넌트

**파일 위치**: `components/ui/LoadingSkeleton.tsx`

**용도**: 연결 상태 확인 중(loading) 표시

**Props**:

```typescript
interface LoadingSkeletonProps {
  /** 스켈레톤 아이템 수 (기본 3) */
  lines?: number

  /** 레이아웃 변형 */
  variant?: 'grid' | 'list' | 'block'
}
```

**variant별 레이아웃**:

| variant | 설명 | 사용 페이지 |
|---------|------|------------|
| `grid` (기본) | `lines`개의 직사각형(h-24, rounded-lg)이 `grid grid-cols-1 md:grid-cols-3 gap-4`로 배치 | 대시보드, 설정 인덱스, 모니터링 인덱스 |
| `list` | `lines`개의 가로로 긴 직사각형(h-12, rounded-lg)이 `space-y-3`으로 수직 배치 | 세션 목록, 로그, 에이전트 목록, 스냅샷 |
| `block` | 1개의 큰 직사각형(h-64, rounded-lg)이 전체 너비로 배치 | 에디터, 세션 상세 |

**공통 스타일**: `animate-pulse`, `bg-bg-secondary`

**표시 조건**: 연결 상태 API 호출 중(`isLoading === true`)일 때만 표시. 응답 수신 후 즉시 사라짐.

---

## 3. 페이지별 변경 명세

### 3.1 pages/+guard.ts 변경

**현재 동작**: 인증(`owm_session`) 미확인 시 `/login`으로 리다이렉트

**추가 동작**: 없음. guard.ts는 변경하지 않는다. 각 페이지 컴포넌트가 `useConnectionStatus` 훅으로 연결 상태를 자체 판별한다.

**근거**: guard.ts에서 `/api/connection`을 호출하면 모든 페이지 전환마다 추가 API 호출이 발생한다. 이미 각 페이지에서 `useConnectionStatus`를 사용하므로, 컴포넌트 레벨에서 처리하는 것이 네트워크 비용과 사용자 체감 속도 면에서 유리하다.

### 3.2 pages/index/+Page.tsx (대시보드) 변경

**현재 동작**:
- `useHealthData()`만 사용
- `!loading && !connected` 일 때: 인라인 `DisconnectedView` 표시
- `setup-required`와 `disconnected`를 구분하지 못함

**변경 후**:
- `useConnectionStatus()`를 추가 import (연결 상태 + config + lastError 판별용)
- `useHealthData()`는 대시보드 데이터 전용으로 유지
- `DisconnectedView` 인라인 컴포넌트 제거
- `SetupRequired`와 `LoadingSkeleton` import

**코드 변경**:

```tsx
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { SetupRequired, LoadingSkeleton } from '../../components/ui'

export default function Page() {
  const { status, isConnected, isLoading } = useConnectionStatus()
  const { health, sessions, channels, events, connected, loading, lastUpdate, refresh } = useHealthData()

  // --- 연결 상태 게이트 (useConnectionStatus 기준) ---
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={3} />
  }
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="대시보드" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="대시보드"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected && status.config) {
    return <SetupRequired pageName="대시보드" variant="disconnected" />
  }

  // --- 정상 상태: 기존 대시보드 콘텐츠 ---
  // (이하 기존 코드 유지)
}
```

**삭제 대상**: 파일 하단의 `function DisconnectedView() { ... }` 전체 삭제

### 3.3 pages/config/index/+Page.tsx (설정 인덱스) 변경

**현재 동작**:
- `useConnectionStatus()`에서 `isConnected`만 사용 (이미 import 됨)
- 미연결 시 하단에 작은 안내 표시. 8개 설정 카드는 활성 상태로 클릭 가능.

**변경 후**:
- `useConnectionStatus()`에서 `{ isConnected, isLoading, status }`를 디스트럭처링
- `SetupRequired`와 `LoadingSkeleton` import

**코드 변경**:

```tsx
import { SetupRequired, LoadingSkeleton } from '../../../components/ui'

export default function Page() {
  const { isConnected, isLoading, status } = useConnectionStatus()

  // --- 연결 상태 게이트 ---
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={6} />
  }
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="설정" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="설정"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected && status.config) {
    return (
      <div>
        {/* 경고 배너: PageHeader 아래, ConfigCard 그리드 위 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">기지 설정</h2>
            <p className="text-sm text-text-secondary mt-1">에이전트의 장비, 스킬, 주문서를 관리하세요</p>
          </div>
          <Badge variant="error">Gateway 연결 안됨</Badge>
        </div>

        <Alert variant="warning" title="Gateway 연결이 끊어졌습니다" className="mb-6">
          설정을 편집하려면 Gateway에 다시 연결해야 합니다.{' '}
          <a href="/server/connection" className="underline font-medium">재연결 설정</a>
        </Alert>

        {/* ConfigCard 비활성 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50 pointer-events-none">
          {/* 8개 ConfigCard 동일 */}
        </div>

        {/* ConfigRelationMap 숨김 (disconnected 시 불필요) */}
      </div>
    )
  }

  // --- 정상 상태: 기존 코드 ---
}
```

**비활성 처리 범위**:
- `ConfigCard` 8개 그리드: `opacity-50 pointer-events-none` 적용
- `ConfigRelationMap`: 렌더링하지 않음 (미연결 시 관계도 불필요)
- 하단 연결 안내 블록: 제거 (상단 `Alert`으로 대체)

### 3.4 pages/monitor/index/+Page.tsx (모니터링 인덱스) 변경

**현재 동작**:
- `useHealthData()`만 사용 (`config` 속성 없음)
- 연결 여부 관계없이 모든 UI 표시

**변경 후**:
- `useConnectionStatus()`를 추가 import
- `useHealthData()`는 대시보드 데이터 전용으로 유지
- `SetupRequired`와 `LoadingSkeleton` import

**코드 변경**:

```tsx
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import { SetupRequired, LoadingSkeleton } from '../../../components/ui'

export default function Page() {
  const { isConnected: connStatus, isLoading, status } = useConnectionStatus()
  const { health, sessions, channels, connected, loading } = useHealthData()

  // --- 연결 상태 게이트 (useConnectionStatus 기준) ---
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={3} />
  }
  if (!connStatus && !status.config && !status.lastError) {
    return <SetupRequired pageName="모니터링" variant="setup" />
  }
  if (!connStatus && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="모니터링"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!connStatus && status.config) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-6">모니터링</h2>
        <Alert variant="warning" title="Gateway 연결이 끊어졌습니다" className="mb-6">
          모니터링 데이터를 받으려면 Gateway에 다시 연결해야 합니다.{' '}
          <a href="/server/connection" className="underline font-medium">재연결 설정</a>
        </Alert>

        {/* 상태 카드: disconnected 표시 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatusCard title="Gateway" status="disconnected" detail="연결되지 않음" />
          <StatusCard title="세션" status="unknown" detail="확인 불가" />
          <StatusCard title="시스템" status="unknown" detail="확인 불가" />
        </div>

        {/* 빠른 링크 비활성 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 opacity-50 pointer-events-none">
          {/* 기존 빠른 링크 카드 3개 */}
        </div>

        {/* 빠른 액션 비활성 */}
        <Card className="p-4 opacity-50 pointer-events-none">
          {/* 기존 빠른 액션 그리드 */}
        </Card>
      </div>
    )
  }

  // --- 정상 상태: 기존 모니터링 콘텐츠 ---
  // (이하 기존 코드 유지, `connected` 대신 `connStatus`로 통일 가능)
}
```

### 3.5 기타 하위 페이지 일괄 처리

아래 페이지들은 개별적으로 연결 상태를 확인하지 않아 빈 화면이 발생할 수 있다.

**대상 페이지 (14개)**:
- `/config/quick`
- `/config/channels`
- `/config/agents`
- `/config/approvals`
- `/config/prompts`
- `/config/security`
- `/config/editor`
- `/config/snapshots`
- `/monitor/agents`
- `/monitor/sessions`
- `/monitor/sessions/:id`
- `/monitor/logs`
- `/server/index`
- `/server/update`

**공통 처리 패턴**:

각 페이지의 `Page` 컴포넌트 최상단에 아래 패턴을 적용:

```tsx
import { useConnectionStatus } from '해당경로/hooks/useConnectionStatus'
import { SetupRequired, LoadingSkeleton } from '해당경로/components/ui'

export default function Page() {
  const { isConnected, isLoading, status } = useConnectionStatus()

  if (isLoading) return <LoadingSkeleton variant="적절한variant" />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="해당 페이지명" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="해당 페이지명"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="해당 페이지명" variant="disconnected" />
  }

  // --- 정상 상태: 기존 페이지 콘텐츠 ---
}
```

**페이지별 LoadingSkeleton variant 매핑**:

| 페이지 | variant | lines |
|--------|---------|-------|
| `/config/quick` | `list` | 5 |
| `/config/channels` | `list` | 4 |
| `/config/agents` | `grid` | 3 |
| `/config/approvals` | `list` | 4 |
| `/config/prompts` | `list` | 4 |
| `/config/security` | `list` | 5 |
| `/config/editor` | `block` | 1 |
| `/config/snapshots` | `list` | 4 |
| `/monitor/agents` | `grid` | 3 |
| `/monitor/sessions` | `list` | 5 |
| `/monitor/sessions/:id` | `block` | 1 |
| `/monitor/logs` | `block` | 1 |
| `/server/index` | `list` | 4 |
| `/server/update` | `list` | 3 |

**예외 페이지** (이 패턴을 적용하지 않는 페이지):
- `/login` -- 인증 전 접근 가능
- `/setup/@step` -- 설치 마법사 자체
- `/server/connection` -- 연결 설정 페이지 (미연결 시에도 접근 가능해야 함)

### 3.6 이중 로딩 정책

`useConnectionStatus`의 `isLoading`과 각 페이지 데이터 훅(예: `useConfig`, `useSessions`, `useLogs` 등)의 자체 `loading`은 별개의 로딩이다.

**로딩 순서**:

```
1단계: useConnectionStatus.isLoading === true
       → LoadingSkeleton 표시 (연결 상태 확인 중)

2단계: useConnectionStatus.isLoading === false, isConnected === true
       → 페이지 콘텐츠 렌더링 시작
       → 각 페이지 데이터 훅의 loading === true 가능
       → 이 때는 페이지 자체의 로딩 표시를 사용

3단계: 각 데이터 훅의 loading === false
       → 완전한 콘텐츠 표시
```

**2단계 로딩 표시 규칙**:
- 각 페이지의 데이터 훅이 `loading` 상태일 때는 해당 페이지가 자체적으로 로딩 표시를 처리한다.
- `LoadingSkeleton`은 1단계(연결 상태 확인)에서만 사용한다.
- 2단계의 데이터 로딩은 기존 방식(하단 토스트, 인라인 스피너 등)을 유지한다.

---

## 4. 상태 매트릭스

모든 보호 대상 페이지에서 아래 상태의 표시가 동일하게 보장되어야 한다.

| 상태 | isLoading | isConnected | status.config | status.lastError | 표시 |
|------|-----------|-------------|---------------|-----------------|------|
| 로딩 중 | true | - | - | - | `LoadingSkeleton` |
| 설치 필요 | false | false | null | null | `SetupRequired` variant="setup" |
| API 에러 | false | false | null | non-null | `SetupRequired` variant="error" |
| 연결 끊김 | false | false | non-null | - | `SetupRequired` variant="disconnected" |
| 정상 | false | true | non-null | - | 해당 페이지 정상 콘텐츠 |

**판별 우선순위** (코드 if문 순서):

```
1. isLoading === true         → LoadingSkeleton
2. !config && !lastError      → variant="setup"
3. !config && lastError       → variant="error"
4. config && !isConnected     → variant="disconnected"
5. isConnected                → 정상 콘텐츠
```

---

## 5. 에러 상태 명세

### API 호출 실패 시

`useConnectionStatus` 훅에서 `GET /api/connection`이 네트워크 에러로 실패하면:
- `isLoading`이 `false`로 전환
- `status`가 `DEFAULT_STATUS`로 유지 (`state: 'disconnected'`, `config: null`, `lastError: null`)

**현재 코드의 catch 블록 수정 필요**:

```typescript
// 현재 (변경 전):
catch {
  // 네트워크 에러 무시
}

// 변경 후:
catch (err) {
  setStatus(prev => ({
    ...prev,
    lastError: err instanceof Error ? err.message : '네트워크 오류'
  }))
}
```

이 수정으로 `status.lastError`가 설정되어, `SetupRequired`에서 `variant="error"`를 판별할 수 있다.

**주의**: `useConnectionStatus`의 `fetchStatus` 함수 catch 블록에 `lastError` 설정을 추가해야 한다. 이것이 CRIT-004의 근본 해결이다.

### WebSocket 연결 실패 시

`useConnectionStatus`의 WebSocket 구독이 끊어져도 초기 REST API 호출 결과는 유지된다. 실시간 상태 변화만 수신하지 못할 뿐, 이전에 조회한 연결 상태는 그대로 표시된다.

### SetupRequired variant="error" 동작

API 에러 시 `SetupRequired`의 `variant="error"` 모드가 표시된다:
- "연결 상태를 확인할 수 없습니다" 제목
- "서버와의 통신에 문제가 있습니다. 네트워크 연결을 확인하세요." 본문
- `errorMessage` prop이 있으면 하단에 `text-error text-xs`로 에러 메시지 표시
- "다시 시도" 버튼: `onRetry` 콜백 호출 (기본 동작: `window.location.reload()`)
- 보조 링크: "설치 마법사로 이동" -> `/setup/1`

이로써 "이미 설치했는데 네트워크 문제인 유저"가 불필요하게 설치 마법사를 시작하는 것을 방지한다. "다시 시도" 버튼이 우선 제공되고, 설치 마법사는 보조 링크로만 제공된다.

---

## 6. 검증 체크리스트

### 빌드 & 타입

- [ ] `npm run build`가 에러 없이 종료된다 (측정: 빌드 실행 후 exit code 0 확인)
- [ ] `npx tsc --noEmit`이 에러 없이 종료된다 (측정: 타입 체크 실행 후 exit code 0 확인)

### 파일 존재 여부

- [ ] `components/ui/SetupRequired.tsx` 파일이 존재한다
- [ ] `components/ui/LoadingSkeleton.tsx` 파일이 존재한다
- [ ] `components/ui/index.ts`에서 `SetupRequired`와 `LoadingSkeleton`을 export한다

### useConnectionStatus 훅 수정

- [ ] `useConnectionStatus`의 `fetchStatus` catch 블록에서 `lastError`를 설정한다 (측정: 코드에서 `catch` 블록 내 `lastError` 설정 확인)

### SetupRequired 컴포넌트 요건

- [ ] `SetupRequired`에 `pageName` prop이 string 타입으로 정의되어 있다
- [ ] `SetupRequired`에 `variant` prop이 `'setup' | 'disconnected' | 'error'` 타입으로 정의되어 있다
- [ ] `SetupRequired`에 `description` prop이 optional string 타입으로 정의되어 있다
- [ ] `SetupRequired`에 `errorMessage` prop이 optional string 타입으로 정의되어 있다
- [ ] `SetupRequired`에 `onRetry` prop이 optional function 타입으로 정의되어 있다
- [ ] `variant="setup"` 일 때 `/setup/1`로 이동하는 주 버튼이 표시된다
- [ ] `variant="disconnected"` 일 때 `/server/connection`으로 이동하는 주 버튼이 표시된다
- [ ] `variant="error"` 일 때 `onRetry`를 호출하는 "다시 시도" 버튼이 표시된다
- [ ] `variant="error"` 일 때 `errorMessage`가 표시된다
- [ ] 모든 variant에서 `/setup/1` 또는 `/server/connection` 링크가 존재한다
- [ ] `SetupRequired`의 최대 너비가 `max-w-lg`로 설정되어 있다

### LoadingSkeleton 컴포넌트 요건

- [ ] `LoadingSkeleton`에 `animate-pulse` 클래스가 적용되어 있다
- [ ] `LoadingSkeleton`에 `lines` prop이 number 타입이며 기본값이 3이다
- [ ] `LoadingSkeleton`에 `variant` prop이 `'grid' | 'list' | 'block'` 타입이며 기본값이 `'grid'`이다
- [ ] `variant="grid"` 일 때 `grid grid-cols-1 md:grid-cols-3 gap-4` 레이아웃이다
- [ ] `variant="list"` 일 때 `space-y-3` 수직 레이아웃이다
- [ ] `variant="block"` 일 때 단일 큰 블록이다

### 대시보드 (pages/index/+Page.tsx)

- [ ] `useConnectionStatus` 훅을 import하여 사용한다
- [ ] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- [ ] `!isConnected && !status.config && !status.lastError`일 때 `SetupRequired` variant="setup"을 렌더링한다
- [ ] `!isConnected && !status.config && status.lastError`일 때 `SetupRequired` variant="error"를 렌더링한다
- [ ] `!isConnected && status.config`일 때 `SetupRequired` variant="disconnected"를 렌더링한다
- [ ] 기존 `DisconnectedView` 인라인 컴포넌트가 삭제되었다

### 설정 인덱스 (pages/config/index/+Page.tsx)

- [ ] `useConnectionStatus`에서 `isLoading`과 `status`를 디스트럭처링한다
- [ ] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- [ ] `!isConnected && !status.config`일 때 `SetupRequired`를 렌더링한다
- [ ] `!isConnected && status.config`일 때 `Alert` 경고 배너 + ConfigCard `opacity-50 pointer-events-none` 적용

### 모니터링 인덱스 (pages/monitor/index/+Page.tsx)

- [ ] `useConnectionStatus` 훅을 추가 import하여 사용한다
- [ ] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다
- [ ] `!isConnected && !status.config`일 때 `SetupRequired`를 렌더링한다
- [ ] `!isConnected && status.config`일 때 `Alert` 경고 배너 + 빠른 링크/액션 `opacity-50 pointer-events-none` 적용

### 하위 페이지 일괄 처리 (14개)

- [ ] `/config/quick/+Page.tsx`에서 `useConnectionStatus`를 사용하고, 상태 게이트 패턴 적용
- [ ] `/config/channels/+Page.tsx`에서 동일 패턴 적용
- [ ] `/config/agents/+Page.tsx`에서 동일 패턴 적용
- [ ] `/config/approvals/+Page.tsx`에서 동일 패턴 적용
- [ ] `/config/prompts/+Page.tsx`에서 동일 패턴 적용
- [ ] `/config/security/+Page.tsx`에서 동일 패턴 적용
- [ ] `/config/editor/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- [ ] `/config/snapshots/+Page.tsx`에서 동일 패턴 적용
- [ ] `/monitor/agents/+Page.tsx`에서 동일 패턴 적용
- [ ] `/monitor/sessions/+Page.tsx`에서 동일 패턴 적용
- [ ] `/monitor/sessions/@id/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- [ ] `/monitor/logs/+Page.tsx`에서 동일 패턴 적용 (`LoadingSkeleton variant="block"`)
- [ ] `/server/index/+Page.tsx`에서 동일 패턴 적용
- [ ] `/server/update/+Page.tsx`에서 동일 패턴 적용

### 예외 페이지 무변경

- [ ] `/login/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- [ ] `/setup/@step/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- [ ] `/server/connection/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다
- [ ] `/server/connection/+Page.tsx`가 미연결 상태에서 정상 렌더링된다 (빈 화면 아님)

### 일관성 검증

- [ ] 보호 대상 15개 페이지(대시보드 포함) 모두에서 `SetupRequired` 문자열이 검색된다 (측정: 프로젝트 전체 grep으로 15개 파일 매칭 확인)
- [ ] 보호 대상 15개 페이지 모두에서 `LoadingSkeleton` 문자열이 검색된다 (측정: 프로젝트 전체 grep으로 15개 파일 매칭 확인)
- [ ] 예외 3개 페이지(`login`, `setup/@step`, `server/connection`)에는 `SetupRequired`가 검색되지 않는다

---

## 7. 스코프 및 향후 개선

### 이번 스프린트 스코프

이 스프린트(Sprint-001)는 **연결 상태 보호 인프라 구축**이 목표이다. 게이미피케이션 UI 요소는 적용 범위 밖이다. SetupRequired와 LoadingSkeleton은 표준적인 empty state / skeleton 패턴을 사용한다.

### 향후 개선 항목

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| NPC 기반 안내 | `SetupRequired`에 에이전트 캐릭터(AgentAvatar)가 등장하여 설치를 안내하는 게이미피케이션 UX | 중 |
| 조사 유틸리티 | `josa()` 함수 도입으로 `을(를)` 표기를 동적 조사 처리로 교체 | 낮 |
| LoadingSkeleton 세분화 | 페이지별 커스텀 스켈레톤 (현재는 3 variant로 통일) | 낮 |
| 오프라인 감지 | `navigator.onLine` + `online`/`offline` 이벤트로 브라우저 수준 네트워크 끊김 감지 | 중 |

---

## 8. UI 설계

### 8.1 컴포넌트 트리 구조

보호 대상 페이지의 공통 렌더링 트리:

```
<Layout>                          ← pages/+Layout.tsx (Sidebar 포함)
  <Sidebar />
  <main>
    <Page />                      ← 각 pages/.../+Page.tsx
      ├── [isLoading]
      │   └── <LoadingSkeleton variant={...} lines={...} />
      │
      ├── [!isConnected && !config && !lastError]
      │   └── <SetupRequired variant="setup" pageName={...} />
      │       ├── 아이콘 (SVG, 80x80, rounded-full, bg-bg-secondary)
      │       ├── <h2> "Gateway에 연결되지 않았습니다"
      │       ├── <p> 설명 텍스트
      │       ├── <Button variant="primary" size="lg">
      │       │     "설치 마법사로 이동" → <a href="/setup/1">
      │       └── <a> "직접 연결 설정" → /server/connection
      │
      ├── [!isConnected && !config && lastError]
      │   └── <SetupRequired variant="error" pageName={...} errorMessage={...} onRetry={...} />
      │       ├── 아이콘 (SVG, 80x80, rounded-full, bg-error/10)
      │       ├── <h2> "연결 상태를 확인할 수 없습니다"
      │       ├── <p> 네트워크 확인 안내
      │       ├── <p className="text-error text-xs"> errorMessage
      │       ├── <Button variant="primary" size="lg" onClick={onRetry}>
      │       │     "다시 시도"
      │       └── <a> "설치 마법사로 이동" → /setup/1
      │
      ├── [!isConnected && config]
      │   ├── (대시보드/하위 페이지)
      │   │   └── <SetupRequired variant="disconnected" pageName={...} />
      │   │
      │   └── (설정 인덱스/모니터링 인덱스 -- 특수 처리)
      │       ├── <Alert variant="warning"> 경고 배너
      │       └── 기존 콘텐츠 (opacity-50 pointer-events-none)
      │
      └── [isConnected]
          └── 정상 페이지 콘텐츠
  </main>
</Layout>
```

### 8.2 상태별 화면 설명

#### 화면 1: 로딩 (isLoading === true)

```
+----------------------------------------------------+
| [Sidebar]  |                                        |
|            |  ┌──────┐  ┌──────┐  ┌──────┐         |
|            |  │▓▓▓▓▓▓│  │▓▓▓▓▓▓│  │▓▓▓▓▓▓│  grid  |
|            |  │      │  │      │  │      │         |
|            |  └──────┘  └──────┘  └──────┘         |
|            |                        animate-pulse   |
+----------------------------------------------------+
```

- `LoadingSkeleton variant="grid"`: 3열 그리드의 회색 블록
- `LoadingSkeleton variant="list"`: 세로 방향 줄 단위 블록
- `LoadingSkeleton variant="block"`: 전체 너비의 큰 단일 블록
- 모든 블록: `bg-bg-secondary rounded-lg animate-pulse`

#### 화면 2: 설치 필요 (variant="setup")

```
+----------------------------------------------------+
| [Sidebar]  |                                        |
|            |              ┌────┐                     |
|            |              │ ⚡ │  80x80 circle       |
|            |              └────┘                     |
|            |                                        |
|            |    Gateway에 연결되지 않았습니다        |
|            |                                        |
|            |    {pageName}을(를) 사용하려면 먼저     |
|            |    Gateway를 연결해야 합니다.           |
|            |                                        |
|            |    ┌─────────────────────┐              |
|            |    │ 설치 마법사로 이동    │  Button     |
|            |    └─────────────────────┘              |
|            |                                        |
|            |    이미 Gateway가 실행 중이라면          |
|            |    직접 연결 설정                        |
|            |                                        |
+----------------------------------------------------+
```

#### 화면 3: API 에러 (variant="error")

```
+----------------------------------------------------+
| [Sidebar]  |                                        |
|            |              ┌────┐                     |
|            |              │ ✕  │  80x80, bg-error/10 |
|            |              └────┘                     |
|            |                                        |
|            |    연결 상태를 확인할 수 없습니다        |
|            |                                        |
|            |    서버와의 통신에 문제가 있습니다.      |
|            |    네트워크 연결을 확인하세요.           |
|            |    "fetch failed"   ← errorMessage      |
|            |                                        |
|            |    ┌──────────┐                         |
|            |    │ 다시 시도 │  Button (onRetry)      |
|            |    └──────────┘                         |
|            |                                        |
|            |    설치 마법사로 이동                    |
|            |                                        |
+----------------------------------------------------+
```

#### 화면 4: 연결 끊김 (variant="disconnected")

```
+----------------------------------------------------+
| [Sidebar]  |                                        |
|            |              ┌────┐                     |
|            |              │ ⚠  │  80x80, bg-warning/10|
|            |              └────┘                     |
|            |                                        |
|            |    Gateway 연결이 끊어졌습니다           |
|            |                                        |
|            |    {pageName}을(를) 사용하려면           |
|            |    Gateway에 다시 연결해야 합니다.       |
|            |                                        |
|            |    ┌──────────┐                         |
|            |    │ 재연결 시도│  Button                |
|            |    └──────────┘                         |
|            |                                        |
|            |    새로운 Gateway로 연결                 |
|            |                                        |
+----------------------------------------------------+
```

#### 화면 5: 설정 인덱스 특수 -- 연결 끊김 (config 있음)

```
+----------------------------------------------------+
| [Sidebar]  |                                        |
|            |  ⚙️ 기지 설정          [Gateway 연결 안됨]|
|            |  에이전트의 장비, 스킬...               |
|            |                                        |
|            |  ┌─────────────────────────────────┐    |
|            |  │ ⚠ Gateway 연결이 끊어졌습니다    │    |
|            |  │   설정을 편집하려면... 재연결 설정 │    |
|            |  └─────────────────────────────────┘    |
|            |                                        |
|            |  ┌──────┐  ┌──────┐  ┌──────┐  opacity |
|            |  │빠른설정│  │채널관리│  │캐릭터 │  -50   |
|            |  └──────┘  └──────┘  └──────┘  pointer |
|            |  ┌──────┐  ┌──────┐  ┌──────┐  -events |
|            |  │스킬  │  │스펠북 │  │보안   │  -none  |
|            |  └──────┘  └──────┘  └──────┘         |
|            |  ┌──────┐  ┌──────┐                    |
|            |  │편집기 │  │스냅샷 │                    |
|            |  └──────┘  └──────┘                    |
+----------------------------------------------------+
```

### 8.3 기존 UI 컴포넌트 재사용 목록

| 기존 컴포넌트 | 사용처 | 용도 |
|--------------|--------|------|
| `Button` | `SetupRequired` 주 버튼 | variant="primary" size="lg" 로 CTA 버튼 |
| `Alert` | 설정 인덱스/모니터링 인덱스 | variant="warning"으로 경고 배너 표시 |
| `Card` | 모니터링 인덱스 비활성 영역 | 기존 카드 래퍼 유지, opacity 적용 |
| `Badge` | 설정 인덱스 헤더 | "Gateway 연결 안됨" 상태 뱃지 |
| `StatusCard` | 모니터링 인덱스 비활성 | disconnected/unknown 상태 표시 |
| `PageHeader` | 향후 통일 시 | 페이지 제목 + 설명 + 액션 영역 (현재는 인라인 사용) |

### 8.4 새로 생성할 컴포넌트

| 컴포넌트 | 파일 경로 | Tier |
|----------|----------|------|
| `SetupRequired` | `components/ui/SetupRequired.tsx` | Tier 2 (레이아웃) |
| `LoadingSkeleton` | `components/ui/LoadingSkeleton.tsx` | Tier 1 (기본) |

`components/ui/index.ts`에 다음 export 추가:

```typescript
// Tier 1
export { LoadingSkeleton } from './LoadingSkeleton'

// Tier 2
export { SetupRequired } from './SetupRequired'
```

### 8.5 스타일 가이드

**다크 테마 기본**: 모든 신규 컴포넌트는 CSS 변수(`bg-card`, `text-text-primary`, `border-border` 등)를 사용하여 다크/라이트 테마 자동 대응.

**빈 상태 패턴**: 아이콘(80x80 원형) + 제목(24px bold) + 설명(14px) + CTA 버튼 + 보조 링크. `max-w-lg mx-auto mt-12 text-center`.

**로딩 상태 패턴**: `animate-pulse`가 적용된 `bg-bg-secondary rounded-lg` 블록. variant에 따라 grid/list/block 레이아웃.

**경고 배너**: 기존 `Alert` 컴포넌트 variant="warning" 사용. 인라인 링크 포함 가능.

**비활성 처리**: `opacity-50 pointer-events-none` 적용. 시각적으로 흐리게 처리하되, 스크린리더는 여전히 접근 가능하므로 `aria-disabled="true"` 추가 권장.

---

## 부록: 보호 대상 페이지 전체 목록

총 15개 보호 대상 페이지 + 3개 예외 페이지:

| # | 경로 | 페이지명 | LoadingSkeleton variant | 비고 |
|---|------|---------|------------------------|------|
| 1 | `/` | 대시보드 | grid (3) | 대시보드 전용 처리 (섹션 3.2) |
| 2 | `/config/index` | 설정 | grid (6) | 설정 인덱스 전용 처리 (섹션 3.3) |
| 3 | `/config/quick` | 빠른 설정 | list (5) | 공통 패턴 |
| 4 | `/config/channels` | 채널 관리 | list (4) | 공통 패턴 |
| 5 | `/config/agents` | 캐릭터 시트 | grid (3) | 공통 패턴 |
| 6 | `/config/approvals` | 스킬 인벤토리 | list (4) | 공통 패턴 |
| 7 | `/config/prompts` | 스펠북 | list (4) | 공통 패턴 |
| 8 | `/config/security` | 성벽 방어 | list (5) | 공통 패턴 |
| 9 | `/config/editor` | 전체 편집기 | block (1) | 공통 패턴 |
| 10 | `/config/snapshots` | 스냅샷 | list (4) | 공통 패턴 |
| 11 | `/monitor/index` | 모니터링 | grid (3) | 모니터링 인덱스 전용 처리 (섹션 3.4) |
| 12 | `/monitor/agents` | 에이전트 오피스 | grid (3) | 공통 패턴 |
| 13 | `/monitor/sessions` | 세션 관리 | list (5) | 공통 패턴 |
| 14 | `/monitor/sessions/:id` | 세션 상세 | block (1) | 공통 패턴 |
| 15 | `/monitor/logs` | 실시간 로그 | block (1) | 공통 패턴 |
| 16 | `/server/index` | 서버 | list (4) | 공통 패턴 -- 대시보드와 별개 |
| 17 | `/server/update` | 업데이트 | list (3) | 공통 패턴 |
| - | `/login` | 로그인 | - | 예외: 인증 전 접근 |
| - | `/setup/@step` | 설치 마법사 | - | 예외: 설치 마법사 자체 |
| - | `/server/connection` | 연결 설정 | - | 예외: 미연결 시에도 접근 필요 |

> 참고: 위 목록에서 보호 대상은 17개 페이지이다. 원본 스펙의 "14개"는 대시보드(1), 설정 인덱스(1), 모니터링 인덱스(1)를 별도 명세로 분리했기 때문에 세지 않았으나, 이 수정 스펙에서는 모두 포함하여 17개로 통일한다.
