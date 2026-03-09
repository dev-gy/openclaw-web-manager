# Sprint-001 스펙 리뷰

## 리뷰 요약
- 심각도 높음: 4개
- 심각도 중간: 5개
- 심각도 낮음: 3개

---

## 심각도 높음 (반드시 수정)

### [CRIT-001] 대시보드(`pages/index/+Page.tsx`)는 `useHealthData`를 사용하는데 스펙은 `config` 속성에 의존한다

- **위치**: 스펙 섹션 3.2 + 섹션 4 상태 매트릭스
- **문제**: 대시보드 페이지는 `useHealthData()` 훅을 사용하며, 이 훅은 `{ health, sessions, channels, events, connected, loading, lastUpdate, refresh }`를 반환한다. `config` 속성을 반환하지 않는다. 그런데 스펙 섹션 4의 상태 매트릭스는 모든 보호 대상 페이지에서 `status.config`로 `setup-required`와 `disconnected`를 구분하라고 요구한다. 대시보드 페이지에서 이 구분을 하려면 `useConnectionStatus`를 추가로 import해야 하는데, 스펙 섹션 3.2의 코드 예시에는 이 부분이 빠져 있다. 변경 전/후 코드 예시가 `loading`과 `connected`만 사용하고 `config`를 참조하지 않아, `setup-required`와 `disconnected`를 구분하지 못한다.
- **제안**: 대시보드의 변경 후 코드에 `useConnectionStatus`를 추가 import하고 `status.config`를 사용하여 `SetupRequired` vs `DisconnectedView`를 구분하는 분기를 명시하거나, 대시보드만 기존 `DisconnectedView`를 유지한다면 그 이유를 명시해야 한다. 현재는 섹션 3.2와 섹션 4(상태 매트릭스)가 모순된다.

### [CRIT-002] 모니터링 인덱스(`pages/monitor/index/+Page.tsx`)도 `config` 속성이 없는 `useHealthData`만 사용한다

- **위치**: 스펙 섹션 3.4
- **문제**: 모니터링 인덱스 페이지는 `useHealthData()` 훅만 사용하고 있다. 스펙은 `!connected && config === null`과 `!connected && config !== null`을 구분하라고 요구하지만, `useHealthData`는 `config`를 반환하지 않는다. 개발자가 이 스펙만 보고 구현하려면 "config를 어디서 가져오는가?"에 대해 추측해야 한다.
- **제안**: 모니터링 인덱스에서 `useConnectionStatus`를 추가 import해야 한다는 것을 코드 예시로 명시하라. 또는 `useHealthData`를 확장하여 `config`를 반환하도록 변경하는 스펙을 추가하라.

### [CRIT-003] `SetupRequired` 컴포넌트의 두 가지 모드(setup-required / disconnected) 전환 기준이 불명확하다

- **위치**: 스펙 섹션 2.1 + 섹션 3.5
- **문제**: 섹션 2.1에서는 `SetupRequired` 컴포넌트에 `pageName`과 `description`만 Props로 정의한다. 상태별 동작 표에서 `disconnected (config 있음)`일 때 제목과 버튼 텍스트가 바뀐다고 명시한다. 하지만 섹션 3.5의 공통 처리 패턴에서는 다음과 같이 사용한다:
  ```tsx
  if (!isConnected && !status.config) return <SetupRequired pageName="..." />
  if (!isConnected) return <SetupRequired pageName="..." description="Gateway 연결이 끊어졌습니다." />
  ```
  이 코드에서는 `description` prop의 유무로 모드를 구분하는 것처럼 보이지만, 섹션 2.1의 상태별 동작 표는 별도의 `variant` prop이나 조건 로직을 암시하지 않는다. `SetupRequired` 컴포넌트가 `description` prop의 유무만으로 "설치 마법사로 이동" vs "재연결 시도" 버튼을 전환해야 하는 건지, 아니면 별도의 prop(예: `variant: 'setup' | 'disconnected'`)이 필요한 건지 불명확하다.
- **제안**: `SetupRequired`가 내부적으로 어떤 조건(prop)을 기준으로 두 가지 모드를 렌더링하는지 Props 인터페이스에 명시적으로 추가하라. `description` 존재 여부로 암묵적 판단하는 것은 취약하다 -- description을 넣되 setup-required인 경우도 있을 수 있다.

### [CRIT-004] API 에러와 `setup-required`를 동일하게 취급하면 유저가 잘못된 행동을 한다

- **위치**: 스펙 섹션 5 에러 상태 명세
- **문제**: 섹션 5에서 "API 서버 자체에 문제가 있으면 설치/연결이 안 된 것과 동일하게 취급한다"고 명시한다. 하지만 네트워크 에러(예: OWM 서버 다운, 프록시 타임아웃, 일시적 503)로 API 호출이 실패하면 `config === null`이 되고, 유저에게 "설치 마법사로 이동" 버튼이 표시된다. 이미 설치가 완료되어 있고 단순히 네트워크 문제인 유저가 설치 마법사를 다시 시작하면 혼란스럽거나, 기존 설정을 덮어쓸 위험이 있다. `useConnectionStatus`의 `fetchStatus` 함수를 보면, `catch` 블록에서 `status`를 전혀 업데이트하지 않으므로 실제로는 DEFAULT_STATUS(`config: null`)가 유지된다. 이것은 의도적이라고 스펙에 기술되어 있지만, 유저 경험 관점에서 "일시적 네트워크 에러"와 "한 번도 설치하지 않은 상태"를 구분하지 못하는 것은 문제이다.
- **제안**: 최소한 `SetupRequired` 컴포넌트에서 "네트워크 연결을 확인하세요"라는 부가 안내를 표시하거나, API 에러와 정상적 `config === null` 응답을 구분하는 별도 상태(예: `isError`)를 도입하라. `useConnectionStatus`에 이미 `lastError`가 있으므로 이를 활용할 수 있다.

---

## 심각도 중간 (수정 권장)

### [WARN-001] 대시보드의 기존 `DisconnectedView`와 새 `SetupRequired` 컴포넌트의 관계가 불명확하다

- **위치**: 스펙 섹션 3.2
- **문제**: 스펙 섹션 3.2에서 "변경 후"의 `!connected` 분기에서 기존 `DisconnectedView` 유지라고 명시한다. 그런데 섹션 3.5의 공통 처리 패턴에서는 모든 보호 대상 페이지에서 `SetupRequired`를 사용한다. 코드베이스를 확인하면 `DisconnectedView`는 `pages/index/+Page.tsx` 내부에 인라인으로 정의된 로컬 컴포넌트이고, `SetupRequired`와 거의 동일한 레이아웃(아이콘 + 제목 + 설명 + 버튼)이다. 두 컴포넌트가 공존하면 유지보수 부담이 생기고, 대시보드만 다른 UI를 보여주는 이유가 설명되지 않는다.
- **제안**: `DisconnectedView`를 제거하고 대시보드도 `SetupRequired`를 사용하도록 통일하거나, 대시보드만 다른 뷰를 유지하는 이유를 스펙에 명시하라.

### [WARN-002] 설정 인덱스(`pages/config/index`)의 `disconnected (config !== null)` 상태에서 `opacity-50 pointer-events-none` 적용 범위가 모호하다

- **위치**: 스펙 섹션 3.3
- **문제**: "설정 카드에 `opacity-50 pointer-events-none` 적용"이라고 명시하지만, 현재 코드의 설정 인덱스 페이지에는 8개의 `ConfigCard`, 하단의 `ConfigRelationMap`, 그리고 하단 안내 블록이 있다. `ConfigRelationMap`에도 비활성 처리가 필요한지, 하단 안내 블록의 "상단으로 이동"이 구체적으로 어떤 위치인지(헤더 아래? 페이지 최상단 배너?) 불명확하다. 또한 `pointer-events-none`이면 카드의 `<a>` 태그가 클릭 불가능해지지만, `ConfigRelationMap` 내의 `<a>` 태그들에 대해서는 언급이 없다.
- **제안**: 비활성 처리 대상(ConfigCard만? ConfigRelationMap 포함?) 과 안내 배너의 정확한 위치를 명시하라.

### [WARN-003] 하위 페이지 일괄 처리 대상에 현재 `useConnectionStatus`를 사용하지 않는 페이지가 다수 포함되어 있다

- **위치**: 스펙 섹션 3.5
- **문제**: 코드베이스 검색 결과, 14개 보호 대상 페이지 중 현재 `useConnectionStatus`를 import하는 페이지는 `/config/index`, `/config/channels`, `/config/security`, `/server/index` 등 소수이다. 나머지 페이지들(`/config/quick`, `/config/agents`, `/config/approvals`, `/config/prompts`, `/config/editor`, `/config/snapshots`, `/monitor/agents`, `/monitor/sessions`, `/monitor/sessions/@id`, `/monitor/logs`, `/server/update`)은 `useConnectionStatus`를 import하지 않는다. 이 페이지들은 `useConfig`, `useSessions`, `useLogs`, `useAgentActivity` 등 자체 데이터 훅을 사용하며, 이 훅들은 이미 자체적으로 `loading` 상태를 가진다. 스펙 섹션 3.5의 공통 패턴을 적용하면 `useConnectionStatus`의 `isLoading`과 각 훅의 자체 `loading`이 충돌한다 -- `useConnectionStatus`가 로딩 완료되어 정상 콘텐츠를 보여주기 시작한 뒤, 각 훅의 자체 `loading`이 아직 true인 상태가 발생한다. 이 이중 로딩의 UX가 정의되어 있지 않다.
- **제안**: `useConnectionStatus`의 `isLoading`은 연결 상태 확인용이고, 각 페이지 데이터의 `loading`은 별개라는 점을 명시하고, 페이지 데이터 로딩 중의 표시(예: 페이지 자체 스켈레톤 vs 현재 "데이터 로딩 중..." 하단 토스트)에 대한 가이드를 추가하라.

### [WARN-004] `LoadingSkeleton`의 레이아웃 명세가 모든 사용 맥락에 맞지 않는다

- **위치**: 스펙 섹션 2.2
- **문제**: `LoadingSkeleton`은 "3개의 회색 직사각형(h-24, rounded-lg, bg-bg-secondary)이 그리드로 배치"라고 정의되어 있다. 대시보드에서 `<LoadingSkeleton lines={3} />`으로 3열 그리드를 기대하는 것은 자연스럽지만, `/monitor/logs`(터미널 형태), `/monitor/sessions/@id`(상세 페이지 형태), `/config/editor`(2-View 에디터 형태) 같은 페이지에서도 동일한 3-블록 그리드 스켈레톤이 표시되면 사용자가 로딩 후 나타날 콘텐츠의 형태를 예측할 수 없다. `lines` prop이 있지만 레이아웃 자체(그리드 vs 리스트 vs 단일 블록)를 바꿀 수 있는 메커니즘이 없다.
- **제안**: `LoadingSkeleton`에 `variant` prop(예: `'grid' | 'list' | 'detail'`)을 추가하거나, 최소한 현재의 그리드 스켈레톤이 모든 페이지에서 동일하게 사용됨을 명시하여 의도적인 설계임을 밝혀라.

### [WARN-005] 검증 체크리스트에 "보호 대상 14개 페이지 모두에서 `SetupRequired` 검색"이라 했으나 대시보드는 `DisconnectedView`를 유지한다

- **위치**: 스펙 섹션 6 일관성 검증
- **문제**: 섹션 6의 일관성 검증 항목에서 "보호 대상 14개 페이지 모두에서 `SetupRequired` 문자열이 검색된다"라고 체크리스트를 정의한다. 그런데 섹션 3.2에서 대시보드(`pages/index/+Page.tsx`)는 `DisconnectedView`를 유지한다고 명시했다. 대시보드에서 `SetupRequired`를 사용하지 않으면 14개가 아닌 13개 파일에서만 검색될 것이다. 또한 대시보드가 보호 대상 14개에 포함되는지도 명시적이지 않다 -- 섹션 3.5의 "대상 페이지" 목록에 대시보드(`/`)가 빠져 있다.
- **제안**: 대시보드가 보호 대상에 포함되는지 여부를 명확히 하고, 포함된다면 체크리스트를 수정하여 대시보드는 `DisconnectedView`로 별도 체크하거나, 대시보드도 `SetupRequired`로 통일하라.

---

## 심각도 낮음 (참고)

### [INFO-001] `SetupRequired` 컴포넌트의 "을(를)" 조사 처리 문제

- **위치**: 스펙 섹션 2.1 레이아웃
- **문제**: 레이아웃에 `"{pageName}을(를) 사용하려면"`이라고 정의한다. 한국어에서 받침 유무에 따라 "을/를"이 결정된다. `pageName`이 "설정"이면 "설정을", "모니터링"이면 "모니터링을"(둘 다 받침 있음)이라 문제가 없어 보이지만, "세션 상세"나 "에이전트 오피스" 등 받침 없는 이름이 들어오면 "을(를)" 표기가 어색해진다.
- **제안**: `을(를)` 표기를 그대로 쓸 것인지, 한국어 조사 처리 유틸리티(예: `josa()` 함수)를 사용할 것인지 결정하라.

### [INFO-002] 게이미피케이션 요소 부재

- **위치**: 스펙 전체
- **문제**: 프로젝트의 핵심 차별점이 "게임화된 에이전트 관리 UI"라고 CLAUDE.md에 명시되어 있다. 이번 스프린트의 `SetupRequired` 컴포넌트는 일반적인 빈 상태(empty state) 패턴이다. "연결 심볼 80x80px 원형 아이콘 + 텍스트 + 버튼"은 어떤 SaaS 제품에서든 볼 수 있는 표준 패턴이다. 기존 `DisconnectedView`도 거의 동일한 구조를 이미 가지고 있다. 이번 스프린트가 인프라성 작업이라 게이미피케이션이 필요 없다면, 그 이유를 스펙에 한 줄이라도 명시하는 것이 후속 리뷰어에게 도움이 된다.
- **제안**: 최소한 "이 스프린트는 게이미피케이션 적용 범위 밖"이라는 한 줄 스코프 정의를 추가하라. 또는 향후 `SetupRequired`에 캐릭터 기반 안내("NPC가 설치를 도와줌")를 적용할 계획이 있다면 향후 개선 항목에 기재하라.

### [INFO-003] `SetupRequired`의 링크 "직접 연결 설정"이 `/server/connection`으로 향하지만 이 페이지의 존재 여부 검증 항목이 없다

- **위치**: 스펙 섹션 2.1, 섹션 6
- **문제**: `SetupRequired` 컴포넌트가 `/server/connection`으로의 링크를 포함하며, 코드베이스에 `pages/server/connection/+Page.tsx`가 존재하는 것은 확인했다. 그러나 검증 체크리스트(섹션 6)에서는 `/server/connection/+Page.tsx`에 대해 "예외 페이지 무변경"만 체크하고, 이 페이지가 실제로 미연결 상태에서 정상 작동하는지(자체 데이터 로딩 실패 처리 등)에 대한 검증은 없다. `SetupRequired`에서 이 페이지로 보낸 뒤 이 페이지도 빈 화면이면 의미가 없다.
- **제안**: `/server/connection` 페이지가 미연결 상태에서 정상 렌더링되는지 확인하는 체크리스트 항목을 추가하라.
