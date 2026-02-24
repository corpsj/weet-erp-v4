# ERP v4 전체 모듈 검증 + 디자인 리프레시 + 기능 개선

## TL;DR

> **Quick Summary**: WE-ET ERP v4의 10개 모듈을 전수 검사하여 버그를 수정하고, Grok 디자인 철학을 유지하면서 전체 UI/UX를 리프레시하며, 에이전트 자율 판단으로 실무에 도움되는 기능을 개선한다.
> 
> **Deliverables**:
> - 공유 UI 컴포넌트 6개 + 레이아웃 컴포넌트 7개 디자인 리프레시
> - 10개 모듈 워크스페이스 전수 검증 + 디자인 리프레시 + 기능 개선
> - 전체 빌드 통과 + Grok 컬러 팔레트 준수 확인
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 (shared UI) → Task 2 (layout) → Tasks 3-12 (modules) → Task 13 (build verify)

---

## Context

### Original Request
사용자: "그냥 모든 기능이 정상적으로 잘 구현되는지 확인하고 UI/UX를 개선하고 기능 개선측면에서 추가할만한게 있는지 검토해"

### Interview Summary
**Key Discussions**:
- 검증 범위: 전체 10개 모듈 전수 검사
- UI/UX: 디자인 리프레시 — Grok 철학 유지하면서 컴포넌트 전반 다듬기
- 기능 개선: 에이전트 자율 판단 → 제안 후 구현 (모듈당 최대 2-3개)
- 테스트 전략: 테스트 인프라 없이 진행 (빌드 통과가 유일한 자동 게이트)
- AI 기능, 협업 기능, 견적 모듈: 모두 "나중"

**Research Findings**:
- 현재 10개 모듈, 12개 서버 액션 파일, 11개 React Query 훅 파일
- Grok 디자인 95% 준수 (profile color picker만 이탈)
- 협업 수준 Level 1/5 (할일 배정만 있고 알림/댓글 없음)
- DB: 23개 테이블, materials/process_presets는 UI 없음
- Known issue: dev 모드 signup 크래시 (prod 정상)

### Metis Review
**Identified Gaps** (addressed):
- **프로젝트 경로 혼동**: 3개 ERP 프로젝트 존재 → 모든 태스크에 workdir 명시
- **런타임 검증 불가**: 테스트 없음 → `next build`를 유일한 자동 게이트로 설정
- **기능 개선 범위 폭발 위험**: 에이전트 자율 → 모듈당 최대 2-3개 캡
- **추정 모듈 모호**: estimates 모듈 상태 불명 → DO NOT TOUCH로 명시
- **컬러 이탈 가능성**: profile color picker → 감사 + 수정 대상

---

## Work Objectives

### Core Objective
WE-ET ERP v4의 10개 모듈을 빈틈없이 검증하고, Grok 디자인 언어로 전체 UI/UX를 통일 리프레시하며, 실무에 도움되는 소규모 기능 개선을 적용한다.

### Concrete Deliverables
- 공유 UI 컴포넌트 리프레시: `src/components/ui/` (6개 파일)
- 레이아웃 컴포넌트 리프레시: `src/components/layout/` (7개 파일)
- 모듈 워크스페이스 10개 전수 검증 + 리프레시 + 개선
- 서버 액션 12개 파일 코드 리뷰 + 패턴 통일
- `next build` 통과 + Grok 컬러 팔레트 100% 준수

### Definition of Done
- [ ] `npx next build` 성공 (exit 0)
- [ ] Grok 컬러 팔레트 외 색상 없음 (grep 검증)
- [ ] 10개 모듈 모두 리프레시 완료
- [ ] 모듈당 기능 개선 2-3개 적용

### Must Have
- 모든 모듈에 일관된 loading/empty/error 상태
- Grok 팔레트만 사용 (monochrome + danger red)
- 모든 서버 액션에 Zod 검증 + try/catch + ActionResult<T>
- 반응형 레이아웃 유지 (모바일 깨짐 수정)

### Must NOT Have (Guardrails)
- ❌ **데이터베이스 스키마 변경 금지** — 새 테이블, 컬럼 변경, 마이그레이션 파일 생성 금지
- ❌ **인증 플로우 변경 금지** — middleware.ts, supabase/auth.ts, login/signup 수정 금지
- ❌ **새 npm 패키지 추가 금지** — 기존 의존성만 사용 (Tailwind v4, Lucide, Framer Motion, Zod, Sonner, React Query, date-fns, clsx, tailwind-merge)
- ❌ **Grok 팔레트 외 색상 사용 금지** — 허용: #0a0a0a, #141414, #1a1a1a, #2a2a2a, #3a3a3a, #ffffff, #9a9a9a, #b0b0b0, #d4d4d4, #e5e5e5, #ff4d6d (CSS 변수 사용 시 해당 값에 매핑되는 것만)
- ❌ **Estimates 모듈 수정 금지** — placeholder 유지, 건드리지 않음
- ❌ **네비게이션 구조 변경 금지** — 사이드바, 모듈 순서, 라우팅 변경 금지
- ❌ **AI 기능 추가/변경 금지** — 기존 공과금 AI 분석은 그대로 유지
- ❌ **weet-erp, weet-erp-v2 프로젝트 참조/병합 금지** — V4 프로젝트만 수정
- ❌ **문서 파일 생성 금지** — README, JSDoc 추가 금지
- ❌ **성능 최적화 금지** — memoization, lazy loading, bundle splitting 하지 않음 (눈에 보이는 문제가 없는 한)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: None
- **Verification gate**: `npx next build` (exit 0) after each module's changes

### QA Policy
- 매 모듈 수정 후 `npx next build` 실행 → 성공해야 다음 진행
- 디자인 수정 후 Grok 컬러 감사: `grep -rn '#[0-9a-fA-F]\{6\}' src/components/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'` → 빈 결과여야 함
- Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — shared foundation):
├── Task 1: Shared UI 컴포넌트 리프레시 (button, card, input, badge, table, modal) [visual-engineering]
└── Task 2: Layout 컴포넌트 리프레시 (app-shell, sidebar, topbar, module-shell 등) [visual-engineering]

Wave 2 (After Wave 1 — first 5 modules, MAX PARALLEL):
├── Task 3: Hub 대시보드 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 4: Calendar 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 5: Todos 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 6: Memos 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
└── Task 7: Expenses 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]

Wave 3 (After Wave 1 — next 5 modules, MAX PARALLEL):
├── Task 8: Utilities 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 9: Tax Invoices 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 10: Bank Transactions 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
├── Task 11: Vault 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]
└── Task 12: Settings 모듈 검증 + 리프레시 + 개선 (depends: 1, 2) [deep]

Wave 4 (After Waves 2 & 3 — verification):
└── Task 13: 전체 빌드 검증 + Grok 컬러 감사 + 크로스모듈 일관성 체크 (depends: 3-12) [deep]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 2 → Tasks 3-12 (parallel) → Task 13 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Waves 2 & 3)
```

### Dependency Matrix

| Task | Blocked By | Blocks | Wave |
|------|-----------|--------|------|
| 1 (UI 컴포넌트) | — | 3-12 | 1 |
| 2 (Layout) | — | 3-12 | 1 |
| 3 (Hub) | 1, 2 | 13 | 2 |
| 4 (Calendar) | 1, 2 | 13 | 2 |
| 5 (Todos) | 1, 2 | 13 | 2 |
| 6 (Memos) | 1, 2 | 13 | 2 |
| 7 (Expenses) | 1, 2 | 13 | 2 |
| 8 (Utilities) | 1, 2 | 13 | 3 |
| 9 (Tax Invoices) | 1, 2 | 13 | 3 |
| 10 (Bank Transactions) | 1, 2 | 13 | 3 |
| 11 (Vault) | 1, 2 | 13 | 3 |
| 12 (Settings) | 1, 2 | 13 | 3 |
| 13 (Build Verify) | 3-12 | F1-F4 | 4 |
| F1-F4 (Final) | 13 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **2** — T1 → `visual-engineering`, T2 → `visual-engineering`
- **Wave 2**: **5** — T3-T7 → `deep`
- **Wave 3**: **5** — T8-T12 → `deep`
- **Wave 4**: **1** — T13 → `deep`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` + `playwright`, F4 → `deep`

---

## TODOs


- [ ] 1. Shared UI 컴포넌트 리프레시 (button, card, input, badge, table, modal)

  **What to do**:
  - `src/components/ui/` 디렉토리의 6개 파일 전체 리뷰
  - 각 컴포넌트의 Grok 디자인 준수 검증 (색상, 간격, radius, 타이포그래피)
  - Tailwind v4 클래스 최적화 및 일관성 확보
  - 버튼: hover/active/disabled/loading 상태 정리, 크기 variants 통일
  - 카드: border, shadow, padding 패턴 통일
  - Input: focus ring, placeholder, error 상태 디자인 통일
  - Badge: 색상 variants가 Grok 팔레트만 사용하는지 확인
  - Table: 헤더/행/호버 스타일링 통일, 빈 상태 디자인
  - Modal: 오버레이, 애니메이션(Framer Motion), 닫기 패턴 통일
  - 반응형 대응: 모바일에서 깨지는 레이아웃 수정
  - 공통 디자인 토큰 참조가 globals.css CSS 변수와 일치하는지 확인

  **Must NOT do**:
  - 컴포넌트 API(props) 변경 금지 — 기존 모듈에서 사용하는 인터페이스 유지
  - 새로운 UI 컴포넌트 추가 금지
  - Grok 팔레트 외 색상 도입 금지
  - 새 npm 패키지 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX 디자인 집중 작업. 색상, 간격, 타이포그래피, 상태 디자인 전문성 필요
  - **Skills**: []
    - 순수 코드 편집만 필요. Playwright나 브라우저 자동화 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 2와 동시 실행 가능)
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3-12 (모든 모듈이 이 UI 컴포넌트를 사용함)
  - **Blocked By**: None (즉시 시작)

  **References**:

  **Pattern References**:
  - `src/components/ui/button.tsx` — 버튼 variants, 크기, 상태 정의
  - `src/components/ui/card.tsx` — 카드 컨테이너 패턴
  - `src/components/ui/input.tsx` — 입력 필드 + label + error 패턴
  - `src/components/ui/badge.tsx` — 상태 뱃지 색상 variants
  - `src/components/ui/table.tsx` — 데이터 테이블 구조
  - `src/components/ui/modal.tsx` — 모달/다이얼로그 + Framer Motion 애니메이션

  **API/Type References**:
  - `src/app/globals.css` — Grok 디자인 토큰 (CSS 변수): --background, --foreground, --muted 등

  **WHY Each Reference Matters**:
  - globals.css의 CSS 변수가 모든 컴포넌트의 색상 기준점. 여기서 정의된 값만 사용해야 함
  - 각 UI 컴포넌트는 10개 모듈에서 import하여 사용 → API 변경 시 전체 모듈 깨짐

  **Acceptance Criteria**:
  - [ ] 6개 UI 컴포넌트 파일 모두 리프레시 완료
  - [ ] `npx next build` 성공 (exit 0)
  - [ ] Grok 컬러 감사 통과:
    `grep -rn '#[0-9a-fA-F]\{6\}' src/components/ui/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'` → 빈 결과

  **QA Scenarios:**

  ```
  Scenario: UI 컴포넌트 빌드 검증
    Tool: Bash
    Preconditions: weet-erp-v4 프로젝트 디렉토리
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
      2. echo $? → 0이어야 함
    Expected Result: Build 성공, 에러 없음
    Failure Indicators: Build error, TypeScript type error, import error
    Evidence: .sisyphus/evidence/task-1-build-verify.txt

  Scenario: Grok 컬러 팔레트 준수 확인
    Tool: Bash (grep)
    Steps:
      1. grep -rn '#[0-9a-fA-F]\{6\}' src/components/ui/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'
    Expected Result: 빈 출력 (비허용 색상 없음)
    Failure Indicators: 비허용 hex color가 포함된 라인 출력
    Evidence: .sisyphus/evidence/task-1-color-audit.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `style(ui): refresh shared UI components and layout to Grok design`
  - Files: `src/components/ui/*`
  - Pre-commit: `npx next build`

---

- [ ] 2. Layout 컴포넌트 리프레시 (app-shell, sidebar, topbar, module-shell 등)

  **What to do**:
  - `src/components/layout/` 디렉토리의 7개 파일 전체 리뷰
  - app-shell: 전체 앱 레이아웃 구조 검토 (사이드바 + 메인 콘텐츠 영역)
  - sidebar: 메뉴 아이템 간격, 아이콘 크기, active 상태 하이라이트, 접힘/펼침 전환
  - topbar: 페이지 제목, breadcrumb, 액션 버튼 영역 정리
  - module-shell: 모듈 공통 래퍼 (페이지 헤더 + 콘텐츠 영역) 일관성
  - page-header: 제목, 설명, 액션 버튼 배치 통일
  - mobile-bottom-nav: 모바일 하단 네비게이션 탭 디자인 점검
  - 반응형 전환점(breakpoint) 동작 확인: 사이드바 숨김/표시, 하단 네비 표시
  - Framer Motion 전환 애니메이션 일관성 확보

  **Must NOT do**:
  - 네비게이션 구조(메뉴 순서, 라우팅) 변경 금지
  - 새 레이아웃 컴포넌트 추가 금지
  - 사이드바 메뉴 아이템 추가/삭제 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 레이아웃/네비게이션 디자인 작업. 반응형, 간격, 애니메이션 전문성 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 1과 동시 실행 가능)
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3-12
  - **Blocked By**: None (즉시 시작)

  **References**:

  **Pattern References**:
  - `src/components/layout/app-shell.tsx` — 루트 레이아웃 (사이드바 + 콘텐츠)
  - `src/components/layout/sidebar.tsx` — 네비게이션 사이드바
  - `src/components/layout/topbar.tsx` — 상단 바
  - `src/components/layout/module-shell.tsx` — 모듈 공통 래퍼
  - `src/components/layout/page-header.tsx` — 페이지 헤더 컴포넌트
  - `src/components/layout/mobile-bottom-nav.tsx` — 모바일 하단 네비게이션
  - `src/app/globals.css` — CSS 변수 (breakpoint, 색상)

  **WHY Each Reference Matters**:
  - app-shell이 전체 앱의 뼈대. 여기서 사이드바 너비, 콘텐츠 padding이 결정됨
  - sidebar의 active 상태가 현재 경로를 반영해야 함 — usePathname() 사용 확인 필요
  - module-shell이 모든 모듈의 공통 래퍼 → 이 컴포넌트의 padding/margin이 모듈 전체에 영향

  **Acceptance Criteria**:
  - [ ] 7개 Layout 컴포넌트 파일 모두 리프레시 완료
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과 (layout 디렉토리)

  **QA Scenarios:**

  ```
  Scenario: Layout 컴포넌트 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-2-build-verify.txt

  Scenario: Layout 컬러 팔레트 준수 확인
    Tool: Bash (grep)
    Steps:
      1. grep -rn '#[0-9a-fA-F]\{6\}' src/components/layout/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'
    Expected Result: 빈 출력
    Evidence: .sisyphus/evidence/task-2-color-audit.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `style(ui): refresh shared UI components and layout to Grok design`
  - Files: `src/components/layout/*`
  - Pre-commit: `npx next build`
---


- [ ] 3. Hub 대시보드 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: hub-dashboard.tsx 전체 리뷰. 5개 위젯(지표 카드, 포커스 할일, 예정 이벤트, Financial Pulse, 알림 허브) 동작 확인. hub.ts 서버 액션 코드 리뷰 (Zod 검증, try/catch, ActionResult 패턴). 빈 데이터 상태에서 UI 정상 검증
  - **디자인 리프레시**: 위젯 카드 간격/padding 통일, 지표 카드 타이포그래피 정리, 빈 상태 디자인 개선, loading skeleton 추가/개선, 그리드 레이아웃 반응형 점검
  - **기능 개선 (최대 2-3개, 에이전트 자율 판단)**: 대시보드 정보 밀도 개선, 크캡 통재 역할의 위젯 디자인 평가 후 개선. 에이전트가 필요하다고 판단하는 소규모 개선 허용

  **Must NOT do**:
  - Hub 위젯 추가/삭제 금지 (기존 5개 유지)
  - 데이터베이스 스키마 변경 금지
  - AI 기능 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 대시보드 레이아웃 + 서버 액션 코드 리뷰 + 기능 개선을 종합적으로 처리해야 함
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6, 7)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/modules/hub/hub-dashboard.tsx` — Hub 대시보드 전체 UI (5개 위젯, 지표 카드, 알림 허브)
  - `src/lib/api/actions/hub.ts` — 서버 액션 (markAllAsReadAction, markMenuAsReadAction)
  - `src/lib/api/hooks/hub.ts` — React Query 훅 (대시보드 데이터 fetching)
  - `src/lib/api/actions/notifications.ts` — 무드 카운트 액션 (getUnreadMenuCountsAction)
  - `src/types/hub.ts` — Hub 데이터 타입 정의
  - `src/app/globals.css` — Grok 디자인 토큰 (CSS 변수)

  **Acceptance Criteria**:
  - [ ] Hub 대시보드 5개 위젯 전체 리프레시
  - [ ] 빈 데이터 상태에서 empty state UI 정상 표시
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과
  - [ ] 기능 개선 2-3개 적용

  **QA Scenarios:**
  ```
  Scenario: Hub 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-3-build-verify.txt
  ```

  **Commit**: YES
  - Message: `refactor(hub): audit and refresh hub dashboard`
  - Files: `src/components/modules/hub/*`, `src/lib/api/actions/hub.ts`, `src/lib/api/hooks/hub.ts`
  - Pre-commit: `npx next build`

---

- [ ] 4. Calendar 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: calendar-workspace.tsx 전체 리뷰. 캘린더 레이아웃(월/주/일 뷰), 이벤트 CRUD 동작, calendar.ts 서버 액션 코드 리뷰 (Zod, try/catch, ActionResult)
  - **디자인 리프레시**: 캘린더 그리드 셀 디자인, 오늘 표시 하이라이트, 이벤트 카드 스타일링, 이벤트 생성/수정 모달 UI 리프레시, 빈 날짜 empty state
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단. 예) 이벤트 컬러 코드 개선, 날짜 네비게이션 UX 개선 등

  **Must NOT do**:
  - 캘린더 라이브러리 추가/교체 금지
  - DB 스키마 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6, 7)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/modules/calendar/calendar-workspace.tsx` — 캘린더 UI 전체
  - `src/lib/api/actions/calendar.ts` — 서버 액션 (3개: CRUD)
  - `src/lib/api/hooks/calendar.ts` — React Query 훅
  - `src/types/calendar.ts` — 캘린더 타입 정의

  **Acceptance Criteria**:
  - [ ] Calendar 워크스페이스 전체 리프레시
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과

  **QA Scenarios:**
  ```
  Scenario: Calendar 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-4-build-verify.txt
  ```

  **Commit**: YES
  - Message: `refactor(calendar): audit and refresh calendar module`
  - Pre-commit: `npx next build`

---

- [ ] 5. Todos 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: todos-workspace.tsx 전체 리뷰. Board/List/Grid 3개 뷰 모드, 드래그앤드롭, 서브태스크, 담당자 배정, 상태 변경. todos.ts 서버 액션 6개 코드 리뷰
  - **디자인 리프레시**: Board 칸반 카드 디자인, 우선순위 뱃지 스타일, 담당자 아바타 표시, 드래그 핸들 UI, 서브태스크 들여쓰기, 빈 칸반 empty state
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단. 예) 필터링 UX 개선, 할일 상태 전환 애니메이션 등

  **Must NOT do**:
  - 할일 데이터 구조(DB 스키마) 변경 금지
  - 새 뷰 모드 추가 금지 (Board/List/Grid 유지)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6, 7)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/modules/todos/todos-workspace.tsx` — Todos UI 전체 (Board/List/Grid, DnD, 서브태스크)
  - `src/lib/api/actions/todos.ts` — 서버 액션 6개 (CRUD + reorder + status)
  - `src/lib/api/hooks/todos.ts` — React Query 훅
  - `src/lib/api/hooks/users.ts` — useAppUsers() 훅 (담당자 선택용)
  - `src/types/todo.ts` — Todo, TodoAssignee 타입 정의

  **Acceptance Criteria**:
  - [ ] Todos Board/List/Grid 전체 리프레시
  - [ ] 담당자 표시, 서브태스크, 드래그 UI 개선
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과

  **QA Scenarios:**
  ```
  Scenario: Todos 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-5-build-verify.txt
  ```

  **Commit**: YES
  - Message: `refactor(todos): audit and refresh todos module`
  - Pre-commit: `npx next build`

---

- [ ] 6. Memos 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: memos-workspace.tsx 전체 리뷰. 폴더 구조, 메모 CRUD, 첨부파일 업로드, 핀/안핀, 소프트 삭제(휴지통). memos.ts 서버 액션 10개 코드 리뷰
  - **디자인 리프레시**: 메모 카드 디자인, 폴더 트리 스타일링, 첨부파일 표시 개선, 핸들 및 휴지통 UI, 메모 에디터 모달 디자인 리프레시
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단

  **Must NOT do**:
  - DB 스키마 변경 금지
  - 메모 데이터 구조 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5, 7)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/modules/memos/memos-workspace.tsx` — Memos UI 전체 (폴더, 첨부, 휴지통)
  - `src/lib/api/actions/memos.ts` — 서버 액션 10개 (CRUD + 폴더 + 첨부)
  - `src/types/memo.ts` — Memo 타입 정의

  **Acceptance Criteria**:
  - [ ] Memos 워크스페이스 전체 리프레시
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과

  **QA Scenarios:**
  ```
  Scenario: Memos 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-6-build-verify.txt
  ```

  **Commit**: YES
  - Message: `refactor(memos): audit and refresh memos module`
  - Pre-commit: `npx next build`

---

- [ ] 7. Expenses 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: expenses-workspace.tsx 전체 리뷰. 경비 CRUD, 카테고리 필터, 영수증 업로드, 상태 관리. expenses.ts 서버 액션 6개 코드 리뷰 (★ 패턴 골드 스탠더드)
  - **디자인 리프레시**: 경비 테이블/카드 레이아웃, 카테고리 필터 버튼 스타일, 영수증 이미지 표시, 상태 뱃지 디자인, 경비 입력 모달 UI 리프레시
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단. 예) 카테고리별 합계 표시, 날짜 필터 UX 개선 등

  **Must NOT do**:
  - EXPENSE_CATEGORIES 상수 구조 변경 금지 (이전 세션에서 버그 수정함)
  - DB 스키마 변경 금지
  - 승인 워크플로우 추가 금지 (협업 기능은 나중)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5, 6)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/modules/expenses/expenses-workspace.tsx` — Expenses UI 전체 (카테고리 필터, 영수증 업로드, EXPENSE_CATEGORIES 인라인)
  - `src/lib/api/actions/expenses.ts` — 서버 액션 6개 (★ 패턴 골드 스탠더드 — 다른 모듈 참조용)
  - `src/types/expense.ts` — Expense 타입 정의

  **Acceptance Criteria**:
  - [ ] Expenses 워크스페이스 전체 리프레시
  - [ ] `npx next build` 성공
  - [ ] Grok 컬러 감사 통과

  **QA Scenarios:**
  ```
  Scenario: Expenses 빌드 검증
    Tool: Bash
    Steps:
      1. cd /Users/zoopark-studio/Documents/dev/weet-erp-v4 && npx next build
    Expected Result: Build 성공
    Evidence: .sisyphus/evidence/task-7-build-verify.txt
  ```

  **Commit**: YES
  - Message: `refactor(expenses): audit and refresh expenses module`
  - Pre-commit: `npx next build`

---

- [ ] 8. Utilities 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: utilities-workspace.tsx 전체 리뷰. 공과금 CRUD, AI 이미지 분석(기존 유지), 파일 업로드. utilities.ts 서버 액션 8개 코드 리뷰 (analyzeUtilityBill 포함)
  - **디자인 리프레시**: 공과금 테이블/카드 레이아웃, AI 분석 결과 표시 영역, 파일 업로드 UI, 상태 뱃지
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단 (AI 기능 자체는 변경 금지)

  **Must NOT do**: DB 스키마 변경, AI 분석 로직 변경, 새 npm 패키지

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 3 (with Tasks 9-12) | Blocks: 13 | Blocked By: 1, 2

  **References**:
  - `src/components/modules/utilities/utilities-workspace.tsx` — UI 전체 + AI 이미지 분석 표시
  - `src/lib/api/actions/utilities.ts` — 서버 액션 8개 (CRUD + analyzeUtilityBill)
  - `src/types/utility.ts` — Utility 타입 정의

  **Acceptance Criteria**: 리프레시 완료 + `npx next build` 성공 + Grok 컬러 감사
  **Commit**: `refactor(utilities): audit and refresh utilities module`

---

- [ ] 9. Tax Invoices 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: tax-invoices-workspace.tsx 전체 리뷰. 세금계산서 CRUD, 필터링, 검색. tax-invoices.ts 서버 액션 5개 코드 리뷰
  - **디자인 리프레시**: 세금계산서 테이블 레이아웃, 입력 모달 UI, 필터 버튼 스타일, 상태 뱃지
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단

  **Must NOT do**: DB 스키마 변경, 새 npm 패키지

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 3 (with Tasks 8, 10-12) | Blocks: 13 | Blocked By: 1, 2

  **References**:
  - `src/components/modules/tax-invoices/tax-invoices-workspace.tsx` — UI 전체
  - `src/lib/api/actions/tax-invoices.ts` — 서버 액션 5개
  - `src/types/tax-invoice.ts` — TaxInvoice 타입 정의

  **Acceptance Criteria**: 리프레시 완료 + `npx next build` 성공 + Grok 컬러 감사
  **Commit**: `refactor(tax-invoices): audit and refresh tax invoices module`

---

- [ ] 10. Bank Transactions 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: bank-transactions-workspace.tsx 전체 리뷰. 거래 CRUD, 필터링, 검색. bank-transactions.ts 서버 액션 4개 코드 리뷰
  - **디자인 리프레시**: 거래 테이블 레이아웃, 입력 모달, 필터 스타일, 입금/출금 시각적 구분
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단

  **Must NOT do**: DB 스키마 변경, 새 npm 패키지

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 3 (with Tasks 8, 9, 11, 12) | Blocks: 13 | Blocked By: 1, 2

  **References**:
  - `src/components/modules/bank-transactions/bank-transactions-workspace.tsx` — UI 전체
  - `src/lib/api/actions/bank-transactions.ts` — 서버 액션 4개
  - `src/types/bank-transaction.ts` — BankTransaction 타입 정의

  **Acceptance Criteria**: 리프레시 완료 + `npx next build` 성공 + Grok 컬러 감사
  **Commit**: `refactor(bank): audit and refresh bank transactions module`

---

- [ ] 11. Vault 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: vault-workspace.tsx 전체 리뷰. AES 암호화 비밀 CRUD, reveal(복호화) 동작, vault.ts 서버 액션 4개 코드 리뷰
  - **디자인 리프레시**: 비밀 카드 레이아웃, reveal 버튼/애니메이션, 입력 모달, 보안 가시성 표시
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단 (암호화 로직 자체는 변경 금지)

  **Must NOT do**: 암호화/복호화 로직 변경 금지, DB 스키마 변경, APP_ENCRYPTION_KEY 노출

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 3 (with Tasks 8-10, 12) | Blocks: 13 | Blocked By: 1, 2

  **References**:
  - `src/components/modules/vault/vault-workspace.tsx` — Vault UI 전체 (AES 암호화, reveal)
  - `src/lib/api/actions/vault.ts` — 서버 액션 4개 (CRUD + decrypt reveal)
  - `src/types/vault.ts` — Vault 타입 정의

  **Acceptance Criteria**: 리프레시 완료 + `npx next build` 성공 + Grok 컬러 감사
  **Commit**: `refactor(vault): audit and refresh vault module`

---

- [ ] 12. Settings 모듈 검증 + 리프레시 + 개선

  **What to do**:
  - **검증**: settings-workspace.tsx 전체 리뷰. 4개 탭(프로필, 초대코드, 사용자 목록, AI 모델). settings.ts 서버 액션 5개 코드 리뷰
  - **디자인 리프레시**: 탭 UI 디자인, 프로필 편집 폼, 초대코드 관리 UI, 사용자 리스트 테이블, AI 모델 선택 드롭다운
  - **⚠️ 프로필 컬러 피커 이슈**: Grok 팔레트에 맞게 profile_color 선택지를 그레이스케일로 제한하거나 제거 검토
  - **기능 개선 (최대 2-3개)**: 에이전트 자율 판단

  **Must NOT do**: 인증 플로우 변경, DB 스키마 변경, AI 모델 설정 로직 변경

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 3 (with Tasks 8-11) | Blocks: 13 | Blocked By: 1, 2

  **References**:
  - `src/components/modules/settings/settings-workspace.tsx` — Settings UI 전체 (4개 탭)
  - `src/lib/api/actions/settings.ts` — 서버 액션 5개 (profile + invite codes + AI model)
  - `src/types/settings.ts` — Settings 타입 정의

  **Acceptance Criteria**: 리프레시 완료 + profile color 이슈 해결 + `npx next build` 성공 + Grok 컬러 감사
  **Commit**: `refactor(settings): audit and refresh settings module`

---

- [ ] 13. 전체 빌드 검증 + Grok 컬러 감사 + 크로스모듈 일관성 체크

  **What to do**:
  - `npx next build` 실행 → 성공 확인
  - Grok 컬러 감사: `grep -rn '#[0-9a-fA-F]\{6\}' src/components/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'` → 빈 결과
  - 모듈 간 UI 일관성 검사: 각 모듈의 페이지 헤더, 빈 상태, 로딩 상태, 에러 상태가 일관된 패턴을 따르는지 코드 리뷰
  - package.json에 새 의존성 추가되지 않았는지 확인
  - supabase/migrations/에 새 파일 없는지 확인
  - Estimates 모듈 변경 없는지 확인 (`git diff src/app/(dashboard)/estimates/`)

  **Must NOT do**: 파일 수정 금지 (검증만)

  **Recommended Agent Profile**: `deep`, Skills: []
  **Parallelization**: Wave 4 (단독) | Blocks: F1-F4 | Blocked By: 3-12

  **Acceptance Criteria**:
  - [ ] `npx next build` exit 0
  - [ ] Grok 컬러 감사 빈 결과
  - [ ] package.json 변경 없음 (또는 허용된 변경만)
  - [ ] supabase/migrations/ 새 파일 없음
  - [ ] estimates 모듈 미변경
  **Commit**: `chore: final build verification and color audit` (검증만, 파일 수정 없음)

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, grep for patterns). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  **workdir**: `/Users/zoopark-studio/Documents/dev/weet-erp-v4`
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx next build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify Zod validation exists on all server action inputs.
  **workdir**: `/Users/zoopark-studio/Documents/dev/weet-erp-v4`
  Output: `Build [PASS/FAIL] | Lint [N clean/N issues] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start dev server. Navigate to EVERY module via Playwright. Verify: page loads without error, CRUD forms appear, design is consistent Grok monochrome, no broken layouts on mobile viewport. Test: Hub dashboard metrics render, Todos board/list views work, Memo folders expand, Expense categories filter, Calendar events display. Screenshot each module.
  **workdir**: `/Users/zoopark-studio/Documents/dev/weet-erp-v4`
  Output: `Modules [N/N pass] | Design [N/N consistent] | Mobile [N/N ok] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no new deps in package.json, no new migration files, no auth changes, no non-Grok colors. Detect cross-task contamination.
  **workdir**: `/Users/zoopark-studio/Documents/dev/weet-erp-v4`
  Output: `Tasks [N/N compliant] | Guardrails [N/N clean] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After | Commit Message | Files | Verify |
|-------|---------------|-------|--------|
| Task 1-2 | `style(ui): refresh shared UI components and layout to Grok design` | `src/components/ui/*`, `src/components/layout/*` | `npx next build` |
| Task 3 | `refactor(hub): audit and refresh hub dashboard` | `src/components/modules/hub/*`, `src/lib/api/actions/hub.ts`, `src/lib/api/hooks/hub.ts` | `npx next build` |
| Task 4 | `refactor(calendar): audit and refresh calendar module` | `src/components/modules/calendar/*`, `src/lib/api/actions/calendar.ts` | `npx next build` |
| Task 5 | `refactor(todos): audit and refresh todos module` | `src/components/modules/todos/*`, `src/lib/api/actions/todos.ts` | `npx next build` |
| Task 6 | `refactor(memos): audit and refresh memos module` | `src/components/modules/memos/*`, `src/lib/api/actions/memos.ts` | `npx next build` |
| Task 7 | `refactor(expenses): audit and refresh expenses module` | `src/components/modules/expenses/*`, `src/lib/api/actions/expenses.ts` | `npx next build` |
| Task 8 | `refactor(utilities): audit and refresh utilities module` | `src/components/modules/utilities/*`, `src/lib/api/actions/utilities.ts` | `npx next build` |
| Task 9 | `refactor(tax-invoices): audit and refresh tax invoices module` | `src/components/modules/tax-invoices/*`, `src/lib/api/actions/tax-invoices.ts` | `npx next build` |
| Task 10 | `refactor(bank): audit and refresh bank transactions module` | `src/components/modules/bank-transactions/*`, `src/lib/api/actions/bank-transactions.ts` | `npx next build` |
| Task 11 | `refactor(vault): audit and refresh vault module` | `src/components/modules/vault/*`, `src/lib/api/actions/vault.ts` | `npx next build` |
| Task 12 | `refactor(settings): audit and refresh settings module` | `src/components/modules/settings/*`, `src/lib/api/actions/settings.ts` | `npx next build` |
| Task 13 | `chore: final build verification and color audit` | (none — verification only) | `npx next build` |

---

## Success Criteria

### Verification Commands
```bash
npx next build                    # Expected: exit 0, no errors
# Grok color audit — must return empty:
grep -rn '#[0-9a-fA-F]\{6\}' src/components/ | grep -vEi '0a0a0a|141414|1a1a1a|2a2a2a|3a3a3a|ffffff|9a9a9a|b0b0b0|d4d4d4|e5e5e5|ff4d6d'
```

### Final Checklist
- [ ] All 10 modules audited and refreshed
- [ ] Shared UI components (6) refreshed
- [ ] Layout components (7) refreshed
- [ ] `npx next build` passes
- [ ] Grok color palette 100% compliant
- [ ] No new npm dependencies added
- [ ] No database schema changes
- [ ] No auth flow changes
- [ ] Estimates module untouched
- [ ] Module당 기능 개선 2-3개 적용
