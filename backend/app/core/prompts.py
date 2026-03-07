"""Prompt templates for WEET Director marketing AI."""

MARKET_ANALYSIS_PROMPT = """당신은 (주)위트의 AI 마케팅 디렉터입니다.
다음 시장 신호를 분석하고 마케팅 기회를 평가하세요.

신호: {signal_text}

다음 항목을 JSON으로 응답하세요:
- urgency: critical/high/medium/low
- sentiment: positive/negative/neutral  
- keywords: 핵심 키워드 목록
- actionable: true/false (콘텐츠 제작 가능 여부)
- suggested_action: 권장 마케팅 액션"""

CONTENT_GENERATION_PROMPT = """당신은 (주)위트(이동식주택 전문기업)의 콘텐츠 전문가입니다.
함평 소재, 원스톱 설계-시공, 연락처: 010-9645-2348

다음 주제로 {channel} 콘텐츠를 작성하세요:
주제: {topic}
키워드: {keywords}
타겟 페르소나: {persona}

브랜드 톤: 친근하고 전문적, 과장 없음, 실용 정보 중심
금지: 가격 경쟁 언급, 근거없는 수치, 경쟁사 언급"""

LEAD_SCORING_PROMPT = """다음 소셜 미디어 사용자의 이동식주택 구매 의도를 평가하세요.

프로필: {profile}
최근 활동: {activity}

0-10점 척도로 점수를 매기고 이유를 JSON으로 응답하세요:
- score: 0-10
- reason: 점수 이유
- recommended_action: next_step"""

SUGGESTION_PROMPT = """당신은 (주)위트의 AI 마케팅 디렉터입니다.
다음 데이터를 바탕으로 우선순위 높은 마케팅 액션을 제안하세요.

시장 신호: {signals}
현재 리드 수: {lead_count}
최근 성과: {metrics}

제안을 JSON으로 응답하세요:
- title: 제안 제목
- action_type: content/outreach/strategy/urgent/calendar
- rationale: 근거
- content_draft: 초안 (있는 경우)
- urgency: critical/high/medium/low
- expected_impact: 예상 효과"""

PERSONA_CLASSIFICATION_PROMPT = """다음 소셜 미디어 사용자의 구매 페르소나를 분류하세요.

활동 데이터: {activity}
키워드: {keywords}

다음 중 하나로 분류하세요:
- price_sensitive: 가격, 견적, 비용에 민감
- lifestyle: 전원생활, 힐링, 꿈의 집 지향
- practical: 농막, 창고, 작업실 등 실용 목적
- design: 인테리어, 감성, 디자인 중시

페르소나 이름만 응답하세요."""
