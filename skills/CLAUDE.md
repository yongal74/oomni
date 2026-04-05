# OOMNI — AI 에이전트 자동화 플랫폼

## 프로젝트 컨텍스트
OOMNI는 솔로 창업자를 위한 AI 에이전트 자동화 플랫폼입니다.
각 봇은 특정 역할을 수행하고, 결과물은 다음 봇으로 전달됩니다.

## 데이터 저장 위치
- 워크스페이스: `C:/oomni-data/workspaces/`
- 리서치 결과: `C:/oomni-data/research/`
- 생성된 코드: `C:/oomni-data/workspaces/{agentId}/`
- 디자인 결과: `C:/oomni-data/design/`
- 리포트: `C:/oomni-data/reports/`

## 작업 원칙
1. 모든 결과물은 반드시 파일로 저장하세요
2. 파일명에는 날짜(YYYY-MM-DD)를 포함하세요
3. 한국어로 결과물을 작성하세요 (코드 제외)
4. 각 단계 완료 시 간략한 완료 메시지를 출력하세요
5. 에러 발생 시 원인과 대안을 명시하세요

## 봇 파이프라인
Research → Content → Build → Design → Growth → Ops → CEO
