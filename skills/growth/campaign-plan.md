# /campaign-plan — 마케팅 캠페인 기획 및 실행 계획 수립

목표, 예산, 타겟을 입력받아 채널별 세부 실행 계획, 콘텐츠 캘린더, 예산 배분, KPI 설정, 성과 측정 방법을 포함한 완전한 캠페인 플랜을 생성한다.

## 실행 단계

1. **현황 파악**
   - `C:/oomni-data/growth/weekly-report_YYYY-WW.json` 최신 파일 읽기
   - 현재 유입 채널별 성과 확인
   - `C:/oomni-data/growth/segments/segment-data_YYYY-MM-DD.json` 읽기
   - `$ARGUMENTS`에서 캠페인 목표, 예산, 기간 파싱

2. **캠페인 목표 설정 (SMART)**
   입력된 목표를 SMART 기준으로 구체화:
   - Specific: 무엇을 달성할 것인가
   - Measurable: 어떻게 측정할 것인가
   - Achievable: 현실적인가 (현재 베이스라인 기준)
   - Relevant: 비즈니스 목표와 연결되는가
   - Time-bound: 언제까지

3. **채널 선택 및 예산 배분**
   ROI 예상치 기반 채널 우선순위 결정:
   - **콘텐츠/SEO**: 장기 ROI 높음, 단기 느림
   - **트위터/X**: 인디해커 커뮤니티 도달, 무료
   - **Product Hunt**: 런치 임팩트, 무료
   - **유료 광고 (Google/Meta)**: 즉각적, CAC 높음
   - **파트너십**: 레버리지 높음, 시간 소요
   - **이메일 캠페인**: 기존 리스트, 높은 ROI

4. **주차별 실행 계획 수립**
   캠페인 기간 전체를 주차별로 분해:

   **Week 1: 준비 및 세팅**
   - 랜딩 페이지 최적화
   - 추적 코드 설치 (UTM 파라미터)
   - 콘텐츠 사전 제작

   **Week 2-N: 실행**
   - 일별 실행 체크리스트
   - 각 채널 게시 내용

   **마지막 Week: 측정 및 개선**
   - 중간 성과 측정
   - 성과 좋은 채널 예산 증액
   - 성과 없는 채널 중단

5. **콘텐츠 캘린더 생성**
   캠페인 기간 전체 콘텐츠 일정:
   - 날짜별 게시 콘텐츠 목록
   - 채널별 분류
   - 담당 (혼자이므로 자동화 가능 여부 표시)

6. **UTM 파라미터 설정**
   모든 링크에 대한 UTM 파라미터 정의:
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`

7. **KPI 대시보드 설정 가이드**
   - Google Analytics 4 커스텀 리포트 설정법
   - PostHog 퍼널 설정법
   - 주간 리뷰 체크포인트

8. **성과 측정 프레임워크**
   - North Star Metric 1개
   - Supporting Metrics 3-5개
   - Guardrail Metrics (나빠지면 안 되는 것)

## 출력 형식

### 캠페인 플랜 문서 (`campaign-plan_[이름]_YYYY-MM-DD.md`)

```markdown
# 캠페인 플랜: [캠페인 이름]
**기간**: YYYY-MM-DD ~ YYYY-MM-DD (N주)
**예산**: ₩0 (무료 채널만) / ₩N만원
**목표**: [SMART 목표]

---

## 목표 및 KPI

### North Star Metric
**신규 유료 전환 50명** (현재 베이스: 주 8명 → 목표 12명/주)

### Supporting Metrics
| 지표 | 현재 | 목표 | 기간 |
|------|------|------|------|
| 주간 신규 가입 | 47명 | 80명 | 4주 |
| 무료→유료 전환율 | 8.5% | 12% | 4주 |
| 유기 트래픽 | 1,200/주 | 1,800/주 | 4주 |

---

## 채널 전략

### 1. 트위터/X (예산: ₩0, 예상 ROI: 최고)
**목표**: 팔로워 +500, 가입 +30명

**주차별 계획**:
- Week 1: 스레드 2개 (창업 스토리, AI 도구 리스트)
- Week 2: 스레드 2개 + 데일리 트윗 5개
- Week 3: 제품 런치 관련 스레드
- Week 4: 결과 공유 스레드

**콘텐츠 예정**:
| 날짜 | 타입 | 주제 |
|------|------|------|
| 4/7 (월) | 스레드 | AI 도구 47개 실험 결과 |
| 4/9 (수) | 단일 트윗 | MRR 달성 공유 |
| 4/14 (월) | 스레드 | 온보딩 실패에서 배운 것 |

---

### 2. 콘텐츠/SEO (예산: ₩0, 예상 ROI: 장기 높음)
**목표**: 오가닉 트래픽 +50%

**콘텐츠 계획**:
- 블로그 포스트 2개 (키워드: "AI SaaS 자동화", "1인 SaaS 운영")
- 롱테일 SEO 페이지 3개

---

### 3. Product Hunt 런치 (예산: ₩0, 예상 ROI: 단기 최고)
**날짜**: [주차] 화요일 오전 12:01 PST

**준비 사항**:
- [ ] PH 제품 페이지 작성
- [ ] 헌터 섭외
- [ ] 지지자 목록 준비 (이메일 목록 활용)
- [ ] 런치 당일 소통 계획

---

## 주차별 실행 계획

### Week 1 (MM/DD ~ MM/DD): 준비
| 요일 | 할 일 | 채널 | 자동화 여부 |
|------|-------|------|------------|
| 월 | UTM 파라미터 설정 | — | 수동 |
| 화 | 블로그 포스트 1 작성 | SEO | n8n 보조 |
| 수 | 트위터 스레드 #1 발행 | Twitter | Buffer 예약 |
| 목 | 랜딩 페이지 CTA 최적화 | — | 수동 |
| 금 | 이메일 캠페인 세팅 | Email | Resend |

---

## 예산 배분

| 채널 | 배정 예산 | 예상 CAC | 예상 전환 |
|------|---------|---------|---------|
| 콘텐츠 (시간) | 10시간/주 | ₩0 | 장기 |
| 이메일 (Resend) | ₩30,000/월 | ₩600 | 50명 |
| 합계 | ₩30,000 | — | — |

---

## UTM 파라미터 설정

```
트위터 스레드: ?utm_source=twitter&utm_medium=organic&utm_campaign=april-launch&utm_content=thread-ai-tools
이메일 캠페인: ?utm_source=email&utm_medium=newsletter&utm_campaign=april-launch&utm_content=weekly-42
```
```

## 저장 위치

- `C:/oomni-data/growth/campaigns/campaign-plan_[이름]_YYYY-MM-DD.md`
- `C:/oomni-data/growth/campaigns/campaign-calendar_[이름]_YYYY-MM-DD.csv`
- `C:/oomni-data/growth/campaigns/campaign-kpi_[이름]_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 다음 형식으로 입력:
- `[캠페인 이름] [목표] [기간] [예산]`
- `--channels twitter,seo,email,ph` : 사용할 채널
- `--goal signup|conversion|retention` : 주요 목표 타입
- `--budget 0|50000|100000` : 예산 (원)
- `--duration 2|4|8` : 캠페인 기간 (주)
- 예시: `/campaign-plan "4월 봄 런치" "신규 유료 전환 50명" --channels twitter,email,ph --duration 4`
