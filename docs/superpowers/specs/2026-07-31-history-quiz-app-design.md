# 역사 퀴즈 앱 설계

## Context

기존 앱("역사 퀴즈 앱"이라는 제목만 있는 빈 화면)을 실제로 동작하는 퀴즈 앱으로 확장한다. 브레인스토밍 과정에서 처음엔 개인 복습용으로 오해했지만, 실제 요구사항은 **학생들이 각자 풀고, 선생님이 결과를 모아보는 학급용 퀴즈 도구**다. 학생은 이름이 아니라 반+번호로만 식별하고, 응시 횟수는 3회로 제한한다. 학생 점수를 보관/조회해야 하므로 기존에 준비만 되어 있던 Supabase 연결을 실제로 사용하게 되고, 결과 조회 화면과 응시 제한을 지키기 위해 Vercel 서버리스 함수를 추가한다.

## 요구사항 요약

- 문제는 코드에 하드코딩. 세계사 15문제 우선 제공, 추후 한국사 문제를 추가할 수 있도록 `category` 필드로 확장 가능하게 설계
- 학생 식별: **이름 없이 반 + 번호만** 입력
- 문제 수(5/10/15) 선택 → 무작위 N문제 추출 → 4지선다, 선택 즉시 정답/오답 피드백 → 마지막에 점수 화면
- **응시는 학생(반+번호)당 최대 3회로 제한**. 4번째 시도는 차단
- 결과 제출은 자동으로 Supabase에 저장
- 선생님용 결과 조회 화면은 별도 URL 없이 같은 SPA 안에서 화면 전환으로 진입, 비밀번호로 보호
- 비밀번호 보호와 응시 횟수 제한 모두 "진짜" 강제되어야 함 — 브라우저 개발자 도구로 우회할 수 없어야 함
- 새 Supabase 프로젝트가 필요하며, Supabase MCP 도구로 생성한다

## 아키텍처

- 프론트: 기존 Vite + React + TypeScript 그대로, Vercel에 정적 배포 (변경 없음)
- 신규: Vercel 서버리스 함수 3개 (Node 런타임, 추가 패키지 불필요 — 이미 설치된 `@supabase/supabase-js`를 함수 내부에서도 사용)
  - `api/attempts.ts` — 반+번호로 현재까지 응시 횟수 조회 (퀴즈 시작 전 사전 체크용)
  - `api/submit.ts` — 결과 제출. 서버에서 다시 한 번 횟수를 확인한 뒤(경쟁 상태 방지) insert. 이미 3회면 403 반환
  - `api/results.ts` — 선생님용, 비밀번호 검증 후 전체 제출 목록 반환
- Supabase: 신규 프로젝트 1개, 테이블 1개(`quiz_submissions`)

**중요한 설계 변경**: 학생 제출을 서버 함수를 거치도록 바꾸면서, `quiz_submissions` 테이블은 익명(anon) 역할에 select/insert 권한을 전혀 주지 않는다. 모든 읽기/쓰기가 service role key를 쓰는 서버 함수를 통해서만 이루어진다 — 응시 횟수 제한을 "체크 후 삽입"까지 서버에서 원자적으로 처리할 수 있고, 점수 데이터가 브라우저에서 전혀 노출되지 않는다.

### 데이터 모델 — `quiz_submissions` 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, default gen_random_uuid() | PK |
| class_name | text | 반 |
| student_number | int | 출석번호 |
| category | text | 'world' (한국사 추가 시 값만 늘어남) |
| score | int | 맞은 개수 |
| total | int | 전체 문제 수 |
| created_at | timestamptz, default now() | 제출 시각 |

**RLS 정책**: RLS 활성화, anon 역할에 대한 정책 없음(= 완전 차단). 모든 접근은 서버 함수의 service role key로만.

### 환경변수

- 클라이언트용 (기존 패턴 유지, `VITE_` 접두사 → 번들에 포함됨): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (이제 quiz_submissions에는 쓰이지 않지만 클라이언트 supabase 초기화 자체는 기존 그대로 유지)
- 서버 전용 (신규, `VITE_` 접두사 없음 → 브라우저 번들에 절대 포함되지 않음): `SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_PASSWORD`

## 타입 (`src/types/quiz.ts`)

```ts
export type Category = 'world' | 'korea'

export interface Question {
  id: string
  category: Category
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
}

export interface Submission {
  className: string
  studentNumber: number
  category: Category
  score: number
  total: number
}
```

## 파일 구조

```
src/
  types/quiz.ts          # Question, Category, Submission 타입
  data/questions.ts      # 하드코딩 세계사 15문제 (world-01 ~ world-15)
  quiz/
    QuizApp.tsx            # 상태 머신 (screen: intro/question/result/teacherGate/teacherResults)
    QuizApp.css
    IntroScreen.tsx         # 반/번호 입력, 문제 수(5/10/15) 선택
                            # 입력 완료 시 /api/attempts로 남은 횟수 확인, 0회면 시작 버튼 비활성 + 안내 문구
                            # 하단에 "선생님이신가요?" 링크 → teacherGate로 전환
    QuestionCard.tsx        # 4지선다, 즉시 정오답 피드백, 마지막 문제는 버튼 라벨 "결과 보기"
    ResultScreen.tsx        # 점수 표시 + 화면 진입 시 자동으로 /api/submit 호출
                            # 저장 성공/실패(또는 "이미 3회 응시함") 상태 표시, 네트워크 실패 시에만 재시도 버튼
    TeacherGate.tsx          # 비밀번호 입력 폼 → /api/results 에 POST
    TeacherResults.tsx        # 표: 반/번호/점수/문제수/제출시각 (최신순)
  App.tsx                 # <QuizApp />
api/
  attempts.ts              # POST { className, studentNumber } → { attemptsUsed, remaining }
  submit.ts                 # POST { className, studentNumber, category, score, total }
                            # → 서버에서 재확인 후 insert, 이미 3회면 403
  results.ts                # POST { password } → 검증 후 전체 제출 목록 반환 (401/500 처리 포함)
```

## 상태 머신 (`QuizApp.tsx`, `useReducer`)

```ts
type Screen = 'intro' | 'question' | 'result' | 'teacherGate' | 'teacherResults'

interface QuizState {
  screen: Screen
  className: string
  studentNumber: number | null
  attemptsRemaining: number | null   // null = 아직 확인 전
  currentIndex: number
  selectedOption: number | null      // null = 미응답, 버튼 활성/비활성 판단에도 사용
  score: number
  questions: Question[]              // 퀴즈 시작 시 셔플+슬라이스된 스냅샷
  submitStatus: 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached'
  teacherResults: Submission[] | null
  teacherError: string | null
}
```

주요 액션: `CHECK_ATTEMPTS_*`(반/번호 입력 후 남은 횟수 조회 성공/실패), `START`(문제수 받아 셔플·슬라이스 후 question 화면 진입), `SELECT_OPTION`(중복 응답 무시), `NEXT`(마지막이면 result로, 아니면 다음 문제), `SUBMIT_RESULT_*`(성공/실패/한도초과), `RETRY_SUBMIT`, `RESTART`, `OPEN_TEACHER_GATE`, `TEACHER_LOGIN_*`(성공/실패), `BACK_TO_INTRO`.

## 흐름

**학생**: IntroScreen에서 반+번호 입력 → `/api/attempts`로 남은 횟수 확인 → 0회 남았으면 "이미 3회 응시했습니다" 안내 후 시작 불가, 그 외엔 문제 수(5/10/15) 선택 후 시작 → 세계사 문제 중 무작위 N개 셔플 → QuestionCard 반복(선택 즉시 피드백, 재클릭 방지) → 마지막 문제 후 ResultScreen 진입과 동시에 `/api/submit` 자동 호출 → 성공 시 점수 표시, 서버가 한도초과(403)를 반환하면(동시 응시 등으로 사전 체크 이후 조건이 바뀐 드문 경우) 별도 안내. "다시 풀기"는 남은 횟수가 있을 때만 유효(0회면 인트로에서부터 차단).

**선생님**: IntroScreen 하단 링크 → TeacherGate에서 비밀번호 입력 → `/api/results` POST → 성공 시 TeacherResults에 표로 전체 제출 내역 표시.

## 에러 처리

- **제출 실패(네트워크 등)**: 로컬 점수 표시는 그대로 유지, "서버 저장 실패 — 다시 시도" 문구와 재시도 버튼만 노출.
- **제출 시 한도초과(403)**: "이미 3회 응시했습니다" 안내, 재시도 버튼 없음(사전 체크를 통과했지만 그 사이 다른 시도가 기록된 드문 경쟁 상태 케이스).
- **비밀번호 오류**: `/api/results`가 401 반환 → "비밀번호가 틀렸습니다" 표시. 잠금/횟수 제한 없음(요구 범위 밖).
- **서버 환경변수 누락**: 함수가 500과 일반 에러 메시지 반환, 크래시 없음.
- **결과 없음**: TeacherResults에 "아직 제출된 결과가 없습니다" 표시.

## 보안 요약

`quiz_submissions`는 anon 역할에 대해 select/insert 정책이 전혀 없어 브라우저에서 직접 접근이 불가능하다. 응시 횟수 조회, 결과 제출, 선생님 결과 조회 모두 서버 함수 안에서만 service role key로 처리되므로, 브라우저 개발자 도구로도 응시 횟수 제한이나 비밀번호를 우회할 수 없다.

## Supabase 프로젝트 준비

새 Supabase 프로젝트가 없으므로, Supabase MCP 도구(`create_project`, `apply_migration` 등)로 프로젝트 생성과 `quiz_submissions` 테이블/RLS 설정까지 처리한다. 조직(organization)/플랜은 진행 시 사용자에게 확인한다.

## 검증 계획

1. `npm run lint`, `npx tsc -b --noEmit`, `npm run build`
2. `npm run dev`로 학생 흐름 수동 확인: 반/번호 입력 → 남은 횟수 확인 → 문제수 선택 → 퀴즈 진행 → 정오답 피드백 → 결과 화면 → Supabase에 레코드 실제로 쌓이는지 확인(`mcp__supabase__execute_sql`로 조회)
3. 같은 반+번호로 4번째 시도 시 시작 자체가 막히는지 확인
4. 선생님 화면: 틀린 비밀번호 → 401/에러 메시지, 맞는 비밀번호 → 결과 표 정상 표시
5. `/api/attempts`, `/api/submit`, `/api/results`가 로컬(`vercel dev`) 또는 배포 환경에서 정상 동작하는지 확인, 클라이언트 번들에 `SUPABASE_SERVICE_ROLE_KEY`/`TEACHER_PASSWORD`가 포함되지 않았는지 빌드 산출물에서 grep으로 확인
6. Vercel 배포 후 실제 URL에서 전체 플로우 재확인, 새 환경변수(`SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_PASSWORD`)를 Vercel 프로젝트 설정에 등록
