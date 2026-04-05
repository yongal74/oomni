# /design-dashboard — SaaS 대시보드 UI 완전 설계 및 구현

사용자 역할(User/Admin)과 제품 기능에 맞는 완성된 대시보드 UI를 설계하고 구현한다. 사이드바 네비게이션, 헤더, 주요 위젯(차트, 통계 카드, 테이블)을 Tailwind + Recharts로 생성한다.

## 실행 단계

1. **대시보드 요구사항 파악**
   - `C:/oomni-data/config/product.json`에서 핵심 지표 목록 읽기
   - `$ARGUMENTS`에서 대시보드 타입과 표시할 데이터 파악
   - 사용자 역할별 화면 결정 (일반 사용자 vs 관리자)

2. **페이지 레이아웃 생성**
   파일 구조:
   ```
   src/app/(dashboard)/
     layout.tsx           # 대시보드 레이아웃 (사이드바 + 헤더)
     page.tsx             # 메인 대시보드
     analytics/page.tsx   # 분석 페이지
     settings/page.tsx    # 설정 페이지
   ```

3. **사이드바 네비게이션 생성**
   파일 위치: `src/components/dashboard/Sidebar.tsx`
   - 로고 영역
   - 주요 메뉴 그룹 (네비게이션, 도구, 설정)
   - 각 메뉴 아이콘 (Lucide React)
   - 현재 페이지 활성 상태
   - 접기/펼치기 토글 (모바일 대응)
   - 하단 사용자 프로필 미니 카드

4. **상단 헤더 생성**
   파일 위치: `src/components/dashboard/Header.tsx`
   - 페이지 제목 (breadcrumb)
   - 검색 바
   - 알림 아이콘 (뱃지)
   - 사용자 아바타 + 드롭다운 메뉴

5. **통계 카드 컴포넌트 생성**
   파일 위치: `src/components/dashboard/StatsCard.tsx`
   - 지표 이름, 값, 단위
   - 전월 대비 변화율 (증가 초록/감소 빨강)
   - 미니 스파크라인 차트
   - 로딩 스켈레톤 상태

6. **차트 컴포넌트 생성**
   패키지: `npm install recharts`

   - `LineChart.tsx` — 시계열 트렌드 (MAU, 수익)
   - `BarChart.tsx` — 카테고리별 비교
   - `PieChart.tsx` — 플랜별 비율
   - `AreaChart.tsx` — 누적 성장 곡선

7. **데이터 테이블 생성**
   파일 위치: `src/components/dashboard/DataTable.tsx`
   - 정렬, 필터, 검색 기능
   - 페이지네이션
   - 행 선택 (체크박스)
   - CSV 내보내기
   - 로딩 상태

8. **반응형 최적화**
   - 모바일: 사이드바 → 하단 탭 바
   - 태블릿: 사이드바 아이콘 only 모드
   - 데스크탑: 풀 사이드바

9. **다크 모드 지원**
   Tailwind `dark:` 클래스로 다크 모드 완전 지원

## 출력 형식

### 대시보드 레이아웃

```tsx
// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar user={session.user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 통계 카드 컴포넌트

```tsx
// src/components/dashboard/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number; // % 변화율
  changeLabel?: string; // "지난 달 대비"
  icon?: React.ReactNode;
  trend?: number[]; // 스파크라인 데이터
}

export function StatsCard({ title, value, unit, change, changeLabel, icon, trend }: StatsCardProps) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString('ko-KR') : value}
        </p>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {change !== undefined && (
        <p className={`mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change)}% {changeLabel ?? '전월 대비'}
        </p>
      )}
    </div>
  );
}
```

### 기본 대시보드 KPI 레이아웃

```tsx
// src/app/(dashboard)/page.tsx
import { StatsCard } from '@/components/dashboard/StatsCard';
import { LineChart } from '@/components/dashboard/LineChart';
import { DataTable } from '@/components/dashboard/DataTable';

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">대시보드</h1>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="총 사용자" value={1_240} change={12.5} />
        <StatsCard title="월 구독 수익" value="₩2,480,000" change={8.3} />
        <StatsCard title="활성 구독" value={86} unit="명" change={-2.1} />
        <StatsCard title="이탈률" value="4.2" unit="%" change={-0.8} />
      </div>

      {/* 성장 차트 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineChart title="월간 사용자 성장" />
        <LineChart title="수익 추이" />
      </div>

      {/* 최근 가입 사용자 */}
      <DataTable title="최근 가입 사용자" />
    </div>
  );
}
```

## 저장 위치

- `C:/Users/장우경/oomni/backend/src/app/(dashboard)/`
- `C:/Users/장우경/oomni/backend/src/components/dashboard/`
- `C:/oomni-data/design/dashboard/dashboard-structure_YYYY-MM-DD.json`

## 추가 인자

`$ARGUMENTS` — 선택적으로 다음을 지정할 수 있다:
- `--type user|admin|both` : 대시보드 타입 (기본값: both)
- `--kpis "MAU,MRR,Churn,CAC"` : 표시할 KPI 지표
- `--dark` : 다크 모드 우선 설계
- `--charts line,bar,pie` : 포함할 차트 타입
- `--no-table` : 데이터 테이블 제외
- 예시: `/design-dashboard --type admin --kpis "DAU,MRR,NPS" --dark`
