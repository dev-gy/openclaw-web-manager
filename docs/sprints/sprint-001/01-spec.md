# Sprint-001: 상세 스펙

## 1. Gateway 연결 상태 판별 기준

### 연결 상태 정의

| 상태 | 조건 | 비고 |
|------|------|------|
| `connected` | `GET /api/connection` 응답의 `state === 'connected'` | Gateway와 WebSocket 연결 유지 중 |
| `disconnected` | `state`가 `'disconnected'`이거나 API 응답 실패 | Gateway 정보 없음 |
| `setup-required` | `GET /api/connection` 응답의 `config === null` | 한 번도 연결 설정을 하지 않은 상태 |

`setup-required`는 `disconnected`의 하위 상태이다. `config`가 `null`이면 유저가 한 번도 설치/연결을 시도하지 않은 것이므로 "설치 필요" 안내를 보여야 한다.

## 2. 컴포넌트 명세

### 2.1 SetupRequired 컴포넌트

**파일 위치**: `components/ui/SetupRequired.tsx`

**용도**: Gateway 연결이 안 된 상태에서 보호 대상 페이지에 진입했을 때 표시하는 안내 뷰

**Props**:

```typescript
interface SetupRequiredProps {
  /** 현재 페이지의 한글 이름 (예: "설정", "모니터링") */
  pageName: string
  /** 추가 설명 텍스트 (선택) */
  description?: string
}
```

**레이아웃**:

```
+-----------------------------------------------+
|                                                 |
|       [아이콘: 연결 심볼, 80x80px 원형]         |
|                                                 |
|    "Gateway에 연결되지 않았습니다"   (24px bold) |
|                                                 |
|    "{pageName}을(를) 사용하려면 먼저            |
|     Gateway를 연결해야 합니다."     (14px)      |
|                                                 |
|    [버튼: "설치 마법사로 이동" → /setup/1]      |
|     (accent 배경, 흰색 텍스트, 14px medium)     |
|                                                 |
|    "이미 Gateway가 실행 중이라면"   (12px)      |
|    [링크: "직접 연결 설정" → /server/connection] |
|                                                 |
+-----------------------------------------------+
```

**상태별 동작**:

| 상태 | 표시 내용 |
|------|----------|
| 기본 (setup-required) | 위 레이아웃 그대로 |
| disconnected (config 있음) | 제목 "Gateway 연결이 끊어졌습니다", 버튼 텍스트 "재연결 시도" → `/server/connection` |

**스타일 규칙**:
- 최대 너비: `max-w-lg` (32rem)
- 수평 중앙 정렬: `mx-auto`
- 상단 마진: `mt-12`
- 텍스트 중앙 정렬: `text-center`

### 2.2 LoadingSkeleton 컴포넌트

**파일 위치**: `components/ui/LoadingSkeleton.tsx`

**용도**: 연결 상태 확인 중(loading) 표시

**Props**:

```typescript
interface LoadingSkeletonProps {
  /** 스켈레톤 줄 수 (기본 3) */
  lines?: number
}
```

**레이아웃**: 3개의 회색 직사각형(h-24, rounded-lg, bg-bg-secondary)이 그리드로 배치. `animate-pulse` 적용.

**표시 조건**: 연결 상태 API 호출 중(`isLoading === true`)일 때만 표시. 응답 수신 후 즉시 사라짐.

## 3. 페이지별 변경 명세

### 3.1 pages/+guard.ts 변경

**현재 동작**: 인증(`owm_session`) 미확인 시 `/login`으로 리다이렉트

**추가 동작**: 클라이언트 사이드 네비게이션에서 연결 상태를 확인하지는 않는다. 대신 각 페이지 컴포넌트가 `useConnectionStatus` 훅으로 자체 판별한다. guard.ts는 변경하지 않는다.

**근거**: guard.ts에서 `/api/connection`을 호출하면 모든 페이지 전환마다 추가 API 호출이 발생한다. 이미 각 페이지에서 `useConnectionStatus`나 `useHealthData`를 사용하고 있으므로, 컴포넌트 레벨에서 처리하는 것이 네트워크 비용과 사용자 체감 속도 면에서 유리하다.

### 3.2 pages/index/+Page.tsx (대시보드) 변경

**현재 동작**:
- `loading && !connected` 일 때: 아무것도 표시하지 않음 (빈 화면)
- `!loading && !connected` 일 때: `DisconnectedView` 표시

**변경 후**:
- `loading` 일 때: `LoadingSkeleton` 표시 (3열 그리드 형태)
- `!loading && !connected` 일 때: `DisconnectedView` 유지 (이미 적절히 구현됨)

**코드 변경 위치**: `pages/index/+Page.tsx` 49~52번째 줄 부근

**변경 전**:
```tsx
if (!loading && !connected) {
  return <DisconnectedView />
}
```

**변경 후**:
```tsx
if (loading) {
  return <LoadingSkeleton lines={3} />
}
if (!connected) {
  return <DisconnectedView />
}
```

### 3.3 pages/config/index/+Page.tsx (설정 인덱스) 변경

**현재 동작**: 미연결 시 하단에 작은 안내 표시. 8개 설정 카드는 활성 상태로 클릭 가능.

**변경 후**:
- `isLoading` 일 때: `LoadingSkeleton` 표시
- `!isConnected && config === null` (setup-required) 일 때: `SetupRequired` 컴포넌트로 전체 교체 (설정 카드 숨김)
- `!isConnected && config !== null` (disconnected) 일 때: 기존 하단 안내를 상단으로 이동하고, 설정 카드에 `opacity-50 pointer-events-none` 적용

### 3.4 pages/monitor/index/+Page.tsx (모니터링 인덱스) 변경

**현재 동작**: 연결 여부 관계없이 상태 카드와 빠른 링크 표시. "연결되지 않음"만 상태카드에 표시.

**변경 후**:
- `loading` 일 때: `LoadingSkeleton` 표시
- `!connected && config === null` 일 때: `SetupRequired` 컴포넌트 표시 (pageName: "모니터링")
- `!connected && config !== null` 일 때: 상단에 경고 배너 + 빠른 링크/액션은 비활성

### 3.5 기타 하위 페이지 일괄 처리

아래 페이지들은 개별적으로 연결 상태를 확인하지 않아 빈 화면이 발생할 수 있다.

**대상 페이지**:
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

**공통 처리 방법**:

각 페이지의 `Page` 컴포넌트 최상단에 아래 패턴을 적용:

```tsx
const { isConnected, isLoading, status } = useConnectionStatus()

if (isLoading) return <LoadingSkeleton />
if (!isConnected && !status.config) return <SetupRequired pageName="해당 페이지명" />
if (!isConnected) return <SetupRequired pageName="해당 페이지명" description="Gateway 연결이 끊어졌습니다." />
```

**예외 페이지** (이 패턴을 적용하지 않는 페이지):
- `/login` — 인증 전 접근 가능
- `/setup/@step` — 설치 마법사 자체
- `/server/connection` — 연결 설정 페이지 (미연결 시에도 접근 가능해야 함)

## 4. 상태 매트릭스

모든 보호 대상 페이지에서 아래 3가지 상태의 표시가 동일하게 보장되어야 한다.

| 상태 | isLoading | isConnected | status.config | 표시 |
|------|-----------|-------------|---------------|------|
| 로딩 중 | true | - | - | `LoadingSkeleton` |
| 설치 필요 | false | false | null | `SetupRequired` (설치 마법사 안내) |
| 연결 끊김 | false | false | non-null | `SetupRequired` (재연결 안내 변형) |
| 정상 | false | true | non-null | 해당 페이지 정상 콘텐츠 |

## 5. 에러 상태 명세

### API 호출 실패 시

`useConnectionStatus` 훅에서 `GET /api/connection`이 네트워크 에러로 실패하면:
- `isLoading`이 `false`로 전환
- `status.state`가 `'disconnected'`로 유지
- `status.config`가 `null`로 유지

이 경우 `SetupRequired` 컴포넌트가 표시된다. 이는 의도적인 동작이다: API 서버 자체에 문제가 있으면 설치/연결이 안 된 것과 동일하게 취급한다.

### WebSocket 연결 실패 시

`useConnectionStatus`의 WebSocket 구독이 끊어져도 초기 REST API 호출 결과는 유지된다. 실시간 상태 변화만 수신하지 못할 뿐, 이전에 조회한 연결 상태는 그대로 표시된다.

## 6. 검증 체크리스트

### 빌드 & 타입

- [ ] `npm run build`가 에러 없이 종료된다 (측정: 빌드 실행 후 exit code 0 확인)
- [ ] `npx tsc --noEmit`이 에러 없이 종료된다 (측정: 타입 체크 실행 후 exit code 0 확인)

### 파일 존재 여부

- [ ] `components/ui/SetupRequired.tsx` 파일이 존재한다 (측정: 파일 시스템 확인)
- [ ] `components/ui/LoadingSkeleton.tsx` 파일이 존재한다 (측정: 파일 시스템 확인)
- [ ] `components/ui/index.ts`에서 `SetupRequired`와 `LoadingSkeleton`을 export한다 (측정: 코드 검색 `export.*SetupRequired`, `export.*LoadingSkeleton`)

### 대시보드 (pages/index/+Page.tsx)

- [ ] `loading`이 `true`일 때 `LoadingSkeleton` 컴포넌트를 렌더링한다 (측정: 코드에서 `loading` 분기와 `LoadingSkeleton` 반환 확인)
- [ ] `loading`이 `false`이고 `connected`가 `false`일 때 `DisconnectedView`를 렌더링한다 (측정: 코드에서 분기 확인)

### 설정 인덱스 (pages/config/index/+Page.tsx)

- [ ] `useConnectionStatus` 훅을 import하여 사용한다 (측정: import문 검색)
- [ ] `isLoading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다 (측정: 코드 분기 확인)
- [ ] `!isConnected`이고 `config === null`일 때 `SetupRequired`를 렌더링한다 (측정: 코드 분기 확인)

### 모니터링 인덱스 (pages/monitor/index/+Page.tsx)

- [ ] `useConnectionStatus` 또는 `useHealthData`에서 `loading` 상태를 사용한다 (측정: 코드 검색)
- [ ] `loading`이 `true`일 때 `LoadingSkeleton`을 렌더링한다 (측정: 코드 분기 확인)
- [ ] 미연결 시 `SetupRequired`를 렌더링한다 (측정: 코드 분기 확인)

### 하위 페이지 일괄 처리

- [ ] `/config/quick/+Page.tsx`에서 `useConnectionStatus`를 사용하고, `isLoading` 시 `LoadingSkeleton`, 미연결 시 `SetupRequired`를 렌더링한다 (측정: 코드 검색)
- [ ] `/config/channels/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/agents/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/approvals/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/prompts/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/security/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/editor/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/config/snapshots/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/monitor/agents/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/monitor/sessions/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/monitor/sessions/@id/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/monitor/logs/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/server/index/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)
- [ ] `/server/update/+Page.tsx`에서 동일 패턴을 적용한다 (측정: 코드 검색)

### 예외 페이지 무변경

- [ ] `/login/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다 (측정: 코드 검색으로 import 부재 확인)
- [ ] `/setup/@step/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다 (측정: 코드 검색으로 import 부재 확인)
- [ ] `/server/connection/+Page.tsx`에는 `SetupRequired` 또는 `LoadingSkeleton`이 추가되지 않는다 (측정: 코드 검색으로 import 부재 확인)

### SetupRequired 컴포넌트 요건

- [ ] `SetupRequired`에 `pageName` prop이 string 타입으로 정의되어 있다 (측정: 타입 정의 확인)
- [ ] `SetupRequired`에 `description` prop이 optional string 타입으로 정의되어 있다 (측정: 타입 정의 확인)
- [ ] `SetupRequired`가 `/setup/1`로 이동하는 버튼 또는 링크를 포함한다 (측정: 코드에서 `/setup/1` 문자열 검색)
- [ ] `SetupRequired`가 `/server/connection`으로 이동하는 링크를 포함한다 (측정: 코드에서 `/server/connection` 문자열 검색)
- [ ] `SetupRequired`의 최대 너비가 `max-w-lg`로 설정되어 있다 (측정: className 검색)

### LoadingSkeleton 컴포넌트 요건

- [ ] `LoadingSkeleton`에 `animate-pulse` 클래스가 적용되어 있다 (측정: className 검색)
- [ ] `LoadingSkeleton`에 `lines` prop이 number 타입이며 기본값이 3이다 (측정: 타입 정의 및 기본값 확인)

### 일관성 검증

- [ ] 보호 대상 14개 페이지 모두에서 `SetupRequired` 문자열이 검색된다 (측정: 프로젝트 전체 grep으로 14개 파일 매칭 확인)
- [ ] 보호 대상 14개 페이지 모두에서 `LoadingSkeleton` 문자열이 검색된다 (측정: 프로젝트 전체 grep으로 14개 파일 매칭 확인)
- [ ] 예외 3개 페이지(`login`, `setup/@step`, `server/connection`)에는 `SetupRequired`가 검색되지 않는다 (측정: 해당 파일 grep)
