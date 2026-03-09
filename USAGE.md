# WEET ERP v4 사용 가이드

## 시스템 시작하기

### 필수 조건

- **LMStudio**: localhost:1234에서 실행 중이어야 함
- **Supabase**: `backend/.env`에 설정 완료
- **Python 가상환경**: `backend/.venv/` 존재

### 프론트엔드 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속 → 로그인: `test@we-et.com` / `test1234!`

### 스케줄러 실행

**테스트 (1회 실행)**
```bash
cd backend && .venv/bin/python -m app.orchestrator.main --once
```

**상시 실행 (launchd)**
```bash
cp backend/com.weet.scheduler.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.weet.scheduler.plist
```

**중지**
```bash
launchctl unload ~/Library/LaunchAgents/com.weet.scheduler.plist
```

---

## 일일 워크플로우

### 스케줄러가 자동으로 하는 일

| 시간 | Job | 하는 일 |
|------|-----|---------|
| 06:00 | daily_reset | 일일 카운터 초기화 |
| 07:00 | market_scan | 네이버/유튜브에서 경쟁사·시장 동향 스캔 |
| 08:00 | suggestion_run | AI가 마케팅 제안 생성 |
| 09:00 | daily_report | 일일 성과 리포트 |
| 10:00 | journey_check | 잠재고객 여정 단계 업데이트 |
| 13:00 | content_generate | AI가 채널별 콘텐츠 생성 (블로그, 카페, 인스타) |
| 14:00 | proposal_execute | 승인된 제안 자동 실행 |
| 15:00 | content_publish | 승인된 콘텐츠 게시 |
| 18:00 | lead_hunt | 네이버 카페에서 잠재고객 발굴 |
| 21:00 | evening_followup | 유망 리드 팔로업 (좋아요/팔로우/DM) |
| 22:00 | content_engagement | 게시된 콘텐츠 반응 수집 |
| 23:00 | content_feedback | 콘텐츠 성과 분석 및 인사이트 저장 |
| 5분마다 | manual_lead_collect | 수동 리드 수집 트리거 확인 |
| 15분마다 | dm_monitor | DM 키워드 모니터링 |
| 매주 월 09:00 | weekly_report | 주간 요약 리포트 |
| 매월 1일 09:00 | monthly_analysis | 월간 분석 리포트 |

### 사용자가 매일 하는 일

1. **대시보드** 확인 → 오늘 성과 요약
2. **승인대기** 탭 → AI가 만든 마케팅 제안 확인 → 승인 또는 거절
3. **게시물** 탭 → AI가 생성한 콘텐츠 검토 → 수정 후 게시 승인
4. **잠재고객** 탭 → 새로 발굴된 리드 확인 → 필요시 팔로업
5. **알림센터** → 시스템 이벤트 확인

---

## 프론트엔드 메뉴

| 메뉴 | 설명 |
|------|------|
| 대시보드 | 일일 메트릭스, 채널별 성과, 전체 현황 |
| 승인대기 | AI가 생성한 마케팅 제안 목록. 승인하면 자동 실행됨 |
| 잠재고객 | 네이버 카페에서 발굴된 잠재고객. 여정 단계별 관리 |
| 게시물 | AI가 생성한 콘텐츠 (네이버 블로그, 카페, 인스타그램) |
| 알림센터 | 스케줄러 실행 결과, 에러, 시스템 이벤트 로그 |

---

## 현재 제한사항

- **Instagram**: 비활성화 (`weet_kr` 비밀번호 업데이트 필요)
- **YouTube API**: placeholder (API 키 미설정)
- **LMStudio**: Mac에서 항상 실행 중이어야 함 (꺼지면 콘텐츠 생성 실패)

---

## 트러블슈팅

**스케줄러 로그 확인**
```bash
tail -f backend/logs/scheduler.log
tail -f backend/logs/scheduler-error.log
```

**LMStudio 연결 확인**
```bash
curl http://localhost:1234/v1/models
```

**스케줄러 상태 확인**
```bash
launchctl list | grep weet
```

**스케줄러 재시작**
```bash
launchctl unload ~/Library/LaunchAgents/com.weet.scheduler.plist
launchctl load ~/Library/LaunchAgents/com.weet.scheduler.plist
```
