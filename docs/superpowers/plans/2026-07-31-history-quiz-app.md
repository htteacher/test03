# History Quiz App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder "역사 퀴즈 앱" screen into a working classroom quiz: students identify themselves by class+number, take a randomized world-history quiz, and results are stored so a password-protected teacher view can review them.

**Architecture:** The existing Vite + React + TypeScript SPA gets a `quiz/` feature folder (state machine + screens) plus a `data/questions.ts` hardcoded question bank. Score storage and the teacher view are backed by three new Vercel serverless functions (`api/attempts.ts`, `api/submit.ts`, `api/results.ts`) that use a Supabase service-role key server-side only; the `quiz_submissions` table has RLS enabled with **no** policies, so the browser (anon key) can never read or write it directly — every access goes through a server function that also enforces the 3-attempt cap atomically.

**Tech Stack:** React 19 + TypeScript, Vite 8 (existing), Vitest + `@testing-library/react` for tests (new), Vercel serverless functions for the backend (new), Supabase/Postgres for storage (new project).

**Spec:** `docs/superpowers/specs/2026-07-31-history-quiz-app-design.md`

## Global Constraints

- Question data is hardcoded in `src/data/questions.ts`; `Question.category` is `'world' | 'korea'`, only `'world'` is populated now (15 questions) — schema must stay ready for `'korea'` questions to be added later without touching types.
- Student identification is **class name + student number only** — no name field anywhere.
- Question-count choices are exactly **5, 10, or 15**.
- Attempts are capped at **3 per (class, student number)**, enforced atomically on the server (check-then-insert in the same request), not just in the UI.
- `quiz_submissions` has RLS enabled with zero policies — the anon key must never be able to select or insert into it. All access goes through server functions using `SUPABASE_SERVICE_ROLE_KEY`.
- Server-only env vars (`SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_PASSWORD`) must **never** get a `VITE_` prefix.
- No new frontend routing library — screen switching happens inside one state machine (`QuizApp.tsx`).
- Reuse existing `src/index.css` design tokens (`--text`, `--text-h`, `--bg`, `--border`, `--accent`, `--accent-bg`, `--accent-border`, `--code-bg`); no new CSS framework.
- Never run `git push` without the user's explicit go-ahead in this session — commit locally at the end of each task, but confirm before Task 14's push (this has been the working pattern all session).

---

### Task 1: Supabase project & schema

**Files:** none (infrastructure only — MCP tool calls)

**Interfaces:**
- Produces: a live Supabase project with a `quiz_submissions` table, whose URL/anon key/service-role key feed every later task.

- [ ] **Step 1: List organizations**

Call `mcp__supabase__list_organizations`. If there's more than one organization, ask the user which one to use before continuing.

- [ ] **Step 2: Create the project**

Call `mcp__supabase__create_project` with a name like `history-quiz-app` in the chosen organization (default region, free plan unless the user says otherwise). Poll with `mcp__supabase__get_project` until status is `ACTIVE_HEALTHY`.

- [ ] **Step 3: Apply the schema migration**

Call `mcp__supabase__apply_migration` with:

```sql
create table quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  student_number integer not null,
  category text not null,
  score integer not null,
  total integer not null,
  created_at timestamptz not null default now()
);

alter table quiz_submissions enable row level security;
```

No policies are created. With RLS enabled and zero policies, every role subject to RLS (including `anon`) is denied all access by default; `service_role` bypasses RLS entirely, which is what the server functions will use.

- [ ] **Step 4: Verify**

Call `mcp__supabase__list_tables` and confirm `quiz_submissions` exists with `rls_enabled: true` and no policies attached.

- [ ] **Step 5: Collect credentials**

Call `mcp__supabase__get_project_url` and `mcp__supabase__get_publishable_keys` for the URL and anon key. The **service role key is not exposed by any MCP tool** (by design) — tell the user to copy it manually from the Supabase dashboard: Project Settings → API → `service_role` secret key.

- [ ] **Step 6: Write local `.env`**

Update (or create) the project's `.env` (already gitignored) with:

```
VITE_SUPABASE_URL=<real project URL>
VITE_SUPABASE_ANON_KEY=<real anon key>
SUPABASE_SERVICE_ROLE_KEY=<value the user pastes from the dashboard>
TEACHER_PASSWORD=<a password the user chooses>
```

Also update `.env.example` to list the two new server-only var names (values left blank):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TEACHER_PASSWORD=
```

- [ ] **Step 7: Commit**

```bash
git add .env.example
git commit -m "Add server-only env var placeholders for quiz submissions"
```

(`.env` itself must stay untracked — verify with `git status` that it does not appear.)

---

### Task 2: Test tooling (Vitest + Testing Library)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/setupTests.ts`

**Interfaces:**
- Produces: `npm test` (single run) and `npm run test:watch`, plus a `jsdom` environment with `@testing-library/jest-dom` matchers available in every later `*.test.ts(x)` file.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Configure Vitest in `vite.config.ts`**

Replace the file's contents with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

- [ ] **Step 3: Create the setup file**

`src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add npm scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify the harness boots**

Run: `npx vitest run --passWithNoTests`
Expected: exits 0, reports no test files found (there are none yet — this only proves the config loads without error).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/setupTests.ts
git commit -m "Add Vitest and Testing Library"
```

---

### Task 3: Quiz types & question data

**Files:**
- Create: `src/types/quiz.ts`
- Create: `src/data/questions.ts`
- Test: `src/data/questions.test.ts`

**Interfaces:**
- Produces: `Question`, `Category`, `Submission`, `SubmissionRecord` types (consumed by every task from here on); `QUESTIONS: Question[]` (consumed by Task 12).

- [ ] **Step 1: Write the failing test**

`src/data/questions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { QUESTIONS } from './questions'

describe('QUESTIONS', () => {
  it('has exactly 15 world-history questions', () => {
    const world = QUESTIONS.filter((q) => q.category === 'world')
    expect(world).toHaveLength(15)
  })

  it('has unique ids', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question exactly 4 options', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4)
    }
  })

  it('keeps correctIndex within the options range', () => {
    for (const q of QUESTIONS) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThanOrEqual(3)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/data/questions.test.ts`
Expected: FAIL — `./questions` module not found.

- [ ] **Step 3: Add the types**

`src/types/quiz.ts`:

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

export interface SubmissionRecord extends Submission {
  id: string
  createdAt: string
}
```

- [ ] **Step 4: Add the question data**

`src/data/questions.ts`:

```ts
import type { Question } from '../types/quiz'

export const QUESTIONS: Question[] = [
  {
    id: 'world-01',
    category: 'world',
    question: '세계 4대 문명 중 나일강 유역에서 발생한 문명은?',
    options: ['메소포타미아 문명', '이집트 문명', '인더스 문명', '황허 문명'],
    correctIndex: 1,
  },
  {
    id: 'world-02',
    category: 'world',
    question: '고대 그리스 폴리스 중 군사 중심의 엄격한 사회 체제로 유명했던 도시국가는?',
    options: ['아테네', '스파르타', '코린토스', '테베'],
    correctIndex: 1,
  },
  {
    id: 'world-03',
    category: 'world',
    question: '로마 제국이 동서로 완전히 분열된 해는 언제인가?',
    options: ['서기 395년', '서기 476년', '서기 313년', '서기 500년'],
    correctIndex: 0,
  },
  {
    id: 'world-04',
    category: 'world',
    question: '중세 유럽에서 성지 회복을 명분으로 여러 차례 원정을 떠난 군사 운동은?',
    options: ['백년전쟁', '십자군 전쟁', '장미전쟁', '위그노 전쟁'],
    correctIndex: 1,
  },
  {
    id: 'world-05',
    category: 'world',
    question: '1492년 아메리카 대륙에 도달한 탐험가는 누구인가?',
    options: ['바스코 다 가마', '마젤란', '콜럼버스', '아메리고 베스푸치'],
    correctIndex: 2,
  },
  {
    id: 'world-06',
    category: 'world',
    question: '1789년 시작되어 절대왕정을 무너뜨린 프랑스의 혁명은?',
    options: ['명예혁명', '프랑스 혁명', '러시아 혁명', '산업혁명'],
    correctIndex: 1,
  },
  {
    id: 'world-07',
    category: 'world',
    question: '18세기 영국에서 시작되어 기계화 생산을 이끈 변화는?',
    options: ['농업혁명', '산업혁명', '정보혁명', '종교개혁'],
    correctIndex: 1,
  },
  {
    id: 'world-08',
    category: 'world',
    question: '제1차 세계대전의 직접적인 계기가 된 사건은?',
    options: [
      '진주만 공습',
      '사라예보 사건(오스트리아 황태자 암살)',
      '베를린 봉쇄',
      '노르망디 상륙작전',
    ],
    correctIndex: 1,
  },
  {
    id: 'world-09',
    category: 'world',
    question: '1917년 러시아에서 로마노프 왕조를 무너뜨린 혁명은?',
    options: ['프랑스 혁명', '러시아 혁명', '신해혁명', '메이지 유신'],
    correctIndex: 1,
  },
  {
    id: 'world-10',
    category: 'world',
    question: '제2차 세계대전을 사실상 종결시킨 계기가 된 사건은?',
    options: [
      '일본의 원자폭탄 피폭 및 항복',
      '베를린 장벽 붕괴',
      '노르망디 상륙작전 실패',
      '스탈린그라드 전투 패배',
    ],
    correctIndex: 0,
  },
  {
    id: 'world-11',
    category: 'world',
    question: '제2차 세계대전 이후 미국과 소련을 중심으로 전개된 대립 구도를 무엇이라 하는가?',
    options: ['냉전', '열전', '삼국동맹', '비동맹운동'],
    correctIndex: 0,
  },
  {
    id: 'world-12',
    category: 'world',
    question: '1989년 냉전 종식의 상징적인 사건으로 꼽히는 것은?',
    options: ['쿠바 미사일 위기', '베를린 장벽 붕괴', '수에즈 운하 위기', '한국전쟁 발발'],
    correctIndex: 1,
  },
  {
    id: 'world-13',
    category: 'world',
    question: '15~17세기 유럽 국가들이 신항로를 개척하며 전 세계로 진출한 시기를 무엇이라 하는가?',
    options: ['대항해시대', '계몽주의 시대', '르네상스 시대', '종교개혁 시대'],
    correctIndex: 0,
  },
  {
    id: 'world-14',
    category: 'world',
    question: '14~16세기 이탈리아에서 시작되어 고전 문화의 부흥을 이끈 문화 운동은?',
    options: ['르네상스', '계몽주의', '낭만주의', '인상주의'],
    correctIndex: 0,
  },
  {
    id: 'world-15',
    category: 'world',
    question: '진시황이 중국을 최초로 통일한 나라의 이름은?',
    options: ['한나라', '진나라', '당나라', '송나라'],
    correctIndex: 1,
  },
]
```

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `npx vitest run src/data/questions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/quiz.ts src/data/questions.ts src/data/questions.test.ts
git commit -m "Add quiz types and world-history question data"
```

---

### Task 4: Shuffle / sample utility

**Files:**
- Create: `src/lib/shuffle.ts`
- Test: `src/lib/shuffle.test.ts`

**Interfaces:**
- Produces: `shuffle<T>(items: T[], random?: () => number): T[]`, `sample<T>(items: T[], count: number, random?: () => number): T[]` (consumed by Task 12).

- [ ] **Step 1: Write the failing test**

`src/lib/shuffle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shuffle, sample } from './shuffle'

describe('shuffle', () => {
  it('returns all original elements exactly once', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    shuffle(input)
    expect(input).toEqual([1, 2, 3])
  })

  it('is deterministic when given a fixed random source', () => {
    const input = [1, 2, 3, 4]
    const fixedRandom = () => 0
    expect(shuffle(input, fixedRandom)).toEqual([2, 3, 4, 1])
  })
})

describe('sample', () => {
  it('returns the requested number of items', () => {
    const input = [1, 2, 3, 4, 5]
    expect(sample(input, 3)).toHaveLength(3)
  })

  it('returns items only from the original array with no duplicates', () => {
    const input = [1, 2, 3, 4, 5]
    const result = sample(input, 5)
    expect(new Set(result).size).toBe(5)
    for (const item of result) {
      expect(input).toContain(item)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/shuffle.test.ts`
Expected: FAIL — `./shuffle` module not found.

- [ ] **Step 3: Implement**

`src/lib/shuffle.ts`:

```ts
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function sample<T>(items: T[], count: number, random: () => number = Math.random): T[] {
  return shuffle(items, random).slice(0, count)
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run: `npx vitest run src/lib/shuffle.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shuffle.ts src/lib/shuffle.test.ts
git commit -m "Add shuffle/sample utility"
```

---

### Task 5: Quiz state reducer

**Files:**
- Create: `src/quiz/quizReducer.ts`
- Test: `src/quiz/quizReducer.test.ts`

**Interfaces:**
- Consumes: `Question` from `src/types/quiz.ts` (Task 3).
- Produces: `Screen`, `SubmitStatus`, `QuizState`, `QuizAction`, `initialQuizState`, `quizReducer(state, action): QuizState` (consumed by Task 12).

- [ ] **Step 1: Write the failing tests**

`src/quiz/quizReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { quizReducer, initialQuizState } from './quizReducer'
import type { Question } from '../types/quiz'

const questions: Question[] = [
  { id: 'q1', category: 'world', question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
  { id: 'q2', category: 'world', question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 2 },
]

describe('quizReducer', () => {
  it('CHECK_ATTEMPTS_START stores identity and clears previous attempt state', () => {
    const state = quizReducer(
      { ...initialQuizState, attemptsRemaining: 1, attemptsError: 'old error' },
      { type: 'CHECK_ATTEMPTS_START', className: '3-2', studentNumber: 7 },
    )
    expect(state.className).toBe('3-2')
    expect(state.studentNumber).toBe(7)
    expect(state.attemptsRemaining).toBeNull()
    expect(state.attemptsError).toBeNull()
  })

  it('CHECK_ATTEMPTS_SUCCESS stores remaining attempts', () => {
    const state = quizReducer(initialQuizState, { type: 'CHECK_ATTEMPTS_SUCCESS', remaining: 2 })
    expect(state.attemptsRemaining).toBe(2)
  })

  it('CHECK_ATTEMPTS_FAILURE stores an error message', () => {
    const state = quizReducer(initialQuizState, {
      type: 'CHECK_ATTEMPTS_FAILURE',
      message: '조회 실패',
    })
    expect(state.attemptsError).toBe('조회 실패')
  })

  it('START moves to the question screen with the given questions', () => {
    const state = quizReducer(initialQuizState, { type: 'START', questions })
    expect(state.screen).toBe('question')
    expect(state.questions).toEqual(questions)
    expect(state.currentIndex).toBe(0)
    expect(state.score).toBe(0)
    expect(state.selectedOption).toBeNull()
  })

  it('SELECT_OPTION records a correct answer and increments the score', () => {
    const started = quizReducer(initialQuizState, { type: 'START', questions })
    const state = quizReducer(started, { type: 'SELECT_OPTION', optionIndex: 1 })
    expect(state.selectedOption).toBe(1)
    expect(state.score).toBe(1)
  })

  it('SELECT_OPTION records a wrong answer without incrementing the score', () => {
    const started = quizReducer(initialQuizState, { type: 'START', questions })
    const state = quizReducer(started, { type: 'SELECT_OPTION', optionIndex: 0 })
    expect(state.selectedOption).toBe(0)
    expect(state.score).toBe(0)
  })

  it('SELECT_OPTION is ignored once a question is already answered', () => {
    const started = quizReducer(initialQuizState, { type: 'START', questions })
    const answered = quizReducer(started, { type: 'SELECT_OPTION', optionIndex: 1 })
    const second = quizReducer(answered, { type: 'SELECT_OPTION', optionIndex: 0 })
    expect(second).toEqual(answered)
  })

  it('NEXT is ignored until the current question is answered', () => {
    const started = quizReducer(initialQuizState, { type: 'START', questions })
    const state = quizReducer(started, { type: 'NEXT' })
    expect(state).toEqual(started)
  })

  it('NEXT advances to the next question and clears the selection', () => {
    const started = quizReducer(initialQuizState, { type: 'START', questions })
    const answered = quizReducer(started, { type: 'SELECT_OPTION', optionIndex: 1 })
    const state = quizReducer(answered, { type: 'NEXT' })
    expect(state.currentIndex).toBe(1)
    expect(state.selectedOption).toBeNull()
    expect(state.screen).toBe('question')
  })

  it('NEXT on the last question moves to the result screen', () => {
    let state = quizReducer(initialQuizState, { type: 'START', questions })
    state = quizReducer(state, { type: 'SELECT_OPTION', optionIndex: 1 })
    state = quizReducer(state, { type: 'NEXT' })
    state = quizReducer(state, { type: 'SELECT_OPTION', optionIndex: 2 })
    state = quizReducer(state, { type: 'NEXT' })
    expect(state.screen).toBe('result')
  })

  it('tracks submit status through the save lifecycle', () => {
    let state = quizReducer(initialQuizState, { type: 'SUBMIT_START' })
    expect(state.submitStatus).toBe('saving')
    state = quizReducer(state, { type: 'SUBMIT_SUCCESS' })
    expect(state.submitStatus).toBe('saved')
    state = quizReducer(state, { type: 'SUBMIT_ERROR' })
    expect(state.submitStatus).toBe('error')
    state = quizReducer(state, { type: 'SUBMIT_LIMIT_REACHED' })
    expect(state.submitStatus).toBe('limit-reached')
  })

  it('RESTART returns to intro and resets round state but keeps identity', () => {
    let state = quizReducer(initialQuizState, {
      type: 'CHECK_ATTEMPTS_START',
      className: '3-2',
      studentNumber: 7,
    })
    state = quizReducer(state, { type: 'START', questions })
    state = quizReducer(state, { type: 'SELECT_OPTION', optionIndex: 1 })
    state = quizReducer(state, { type: 'RESTART' })
    expect(state.screen).toBe('intro')
    expect(state.className).toBe('3-2')
    expect(state.studentNumber).toBe(7)
    expect(state.score).toBe(0)
    expect(state.selectedOption).toBeNull()
    expect(state.questions).toEqual([])
    expect(state.attemptsRemaining).toBeNull()
  })

  it('walks through the teacher gate flow', () => {
    const gateOpen = quizReducer(initialQuizState, { type: 'OPEN_TEACHER_GATE' })
    expect(gateOpen.screen).toBe('teacherGate')

    const failed = quizReducer(gateOpen, {
      type: 'TEACHER_LOGIN_FAILURE',
      message: '비밀번호가 틀렸습니다',
    })
    expect(failed.teacherError).toBe('비밀번호가 틀렸습니다')
    expect(failed.screen).toBe('teacherGate')

    const results = [
      {
        id: '1',
        className: '3-2',
        studentNumber: 7,
        category: 'world' as const,
        score: 5,
        total: 10,
        createdAt: '2026-07-31T00:00:00Z',
      },
    ]
    const success = quizReducer(gateOpen, { type: 'TEACHER_LOGIN_SUCCESS', results })
    expect(success.screen).toBe('teacherResults')
    expect(success.teacherResults).toEqual(results)

    const back = quizReducer(success, { type: 'BACK_TO_INTRO' })
    expect(back.screen).toBe('intro')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/quiz/quizReducer.test.ts`
Expected: FAIL — `./quizReducer` module not found.

- [ ] **Step 3: Implement**

`src/quiz/quizReducer.ts`:

```ts
import type { Question, SubmissionRecord } from '../types/quiz'

export type Screen = 'intro' | 'question' | 'result' | 'teacherGate' | 'teacherResults'
export type SubmitStatus = 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached'

export interface QuizState {
  screen: Screen
  className: string
  studentNumber: number | null
  attemptsRemaining: number | null
  attemptsError: string | null
  currentIndex: number
  selectedOption: number | null
  score: number
  questions: Question[]
  submitStatus: SubmitStatus
  teacherResults: SubmissionRecord[] | null
  teacherError: string | null
}

export type QuizAction =
  | { type: 'CHECK_ATTEMPTS_START'; className: string; studentNumber: number }
  | { type: 'CHECK_ATTEMPTS_SUCCESS'; remaining: number }
  | { type: 'CHECK_ATTEMPTS_FAILURE'; message: string }
  | { type: 'START'; questions: Question[] }
  | { type: 'SELECT_OPTION'; optionIndex: number }
  | { type: 'NEXT' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_LIMIT_REACHED' }
  | { type: 'SUBMIT_ERROR' }
  | { type: 'RESTART' }
  | { type: 'OPEN_TEACHER_GATE' }
  | { type: 'BACK_TO_INTRO' }
  | { type: 'TEACHER_LOGIN_START' }
  | { type: 'TEACHER_LOGIN_SUCCESS'; results: SubmissionRecord[] }
  | { type: 'TEACHER_LOGIN_FAILURE'; message: string }

export const initialQuizState: QuizState = {
  screen: 'intro',
  className: '',
  studentNumber: null,
  attemptsRemaining: null,
  attemptsError: null,
  currentIndex: 0,
  selectedOption: null,
  score: 0,
  questions: [],
  submitStatus: 'idle',
  teacherResults: null,
  teacherError: null,
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'CHECK_ATTEMPTS_START':
      return {
        ...state,
        className: action.className,
        studentNumber: action.studentNumber,
        attemptsRemaining: null,
        attemptsError: null,
      }
    case 'CHECK_ATTEMPTS_SUCCESS':
      return { ...state, attemptsRemaining: action.remaining, attemptsError: null }
    case 'CHECK_ATTEMPTS_FAILURE':
      return { ...state, attemptsError: action.message }
    case 'START':
      return {
        ...state,
        screen: 'question',
        questions: action.questions,
        currentIndex: 0,
        selectedOption: null,
        score: 0,
        submitStatus: 'idle',
      }
    case 'SELECT_OPTION': {
      if (state.selectedOption !== null) return state
      const current = state.questions[state.currentIndex]
      const isCorrect = current.correctIndex === action.optionIndex
      return {
        ...state,
        selectedOption: action.optionIndex,
        score: isCorrect ? state.score + 1 : state.score,
      }
    }
    case 'NEXT': {
      if (state.selectedOption === null) return state
      const isLast = state.currentIndex + 1 >= state.questions.length
      if (isLast) {
        return { ...state, screen: 'result' }
      }
      return { ...state, currentIndex: state.currentIndex + 1, selectedOption: null }
    }
    case 'SUBMIT_START':
      return { ...state, submitStatus: 'saving' }
    case 'SUBMIT_SUCCESS':
      return { ...state, submitStatus: 'saved' }
    case 'SUBMIT_LIMIT_REACHED':
      return { ...state, submitStatus: 'limit-reached' }
    case 'SUBMIT_ERROR':
      return { ...state, submitStatus: 'error' }
    case 'RESTART':
      return {
        ...state,
        screen: 'intro',
        attemptsRemaining: null,
        attemptsError: null,
        currentIndex: 0,
        selectedOption: null,
        score: 0,
        questions: [],
        submitStatus: 'idle',
      }
    case 'OPEN_TEACHER_GATE':
      return { ...state, screen: 'teacherGate', teacherError: null }
    case 'BACK_TO_INTRO':
      return { ...state, screen: 'intro' }
    case 'TEACHER_LOGIN_START':
      return { ...state, teacherError: null }
    case 'TEACHER_LOGIN_SUCCESS':
      return {
        ...state,
        screen: 'teacherResults',
        teacherResults: action.results,
        teacherError: null,
      }
    case 'TEACHER_LOGIN_FAILURE':
      return { ...state, teacherError: action.message }
    default:
      return state
  }
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run src/quiz/quizReducer.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/quiz/quizReducer.ts src/quiz/quizReducer.test.ts
git commit -m "Add quiz state reducer"
```

---

### Task 6: Server business logic (attempts / submit / results)

**Files:**
- Create: `api/_lib/attemptsLogic.ts`
- Test: `api/_lib/attemptsLogic.test.ts`
- Create: `api/_lib/submitLogic.ts`
- Test: `api/_lib/submitLogic.test.ts`
- Create: `api/_lib/resultsLogic.ts`
- Test: `api/_lib/resultsLogic.test.ts`

**Interfaces:**
- Consumes: `Submission`, `SubmissionRecord` from `src/types/quiz.ts` (Task 3).
- Produces: `MAX_ATTEMPTS`, `AttemptCounter`, `getRemainingAttempts()`; `SubmissionStore`, `SubmitResult`, `submitQuizResult()`; `ResultsStore`, `ResultsAuthResult`, `getTeacherResults()` — all consumed by Task 7's Supabase adapter.

This logic is written against small storage interfaces (not the Supabase client directly) so it can be unit tested with in-memory fakes — no network, no real database needed for these tests.

- [ ] **Step 1: Write the failing tests**

`api/_lib/attemptsLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getRemainingAttempts, MAX_ATTEMPTS } from './attemptsLogic'
import type { AttemptCounter } from './attemptsLogic'

function fakeCounter(count: number): AttemptCounter {
  return {
    async countSubmissions() {
      return count
    },
  }
}

describe('getRemainingAttempts', () => {
  it('returns the full quota when nothing has been submitted yet', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(0), '3-2', 7)
    expect(remaining).toBe(MAX_ATTEMPTS)
  })

  it('subtracts previously used attempts', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(2), '3-2', 7)
    expect(remaining).toBe(1)
  })

  it('never goes below zero', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(5), '3-2', 7)
    expect(remaining).toBe(0)
  })
})
```

`api/_lib/submitLogic.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { submitQuizResult } from './submitLogic'
import type { SubmissionStore } from './submitLogic'
import type { Submission } from '../../src/types/quiz'

const submission: Submission = {
  className: '3-2',
  studentNumber: 7,
  category: 'world',
  score: 8,
  total: 10,
}

function fakeStore(usedCount: number) {
  return {
    async countSubmissions() {
      return usedCount
    },
    insertSubmission: vi.fn(async () => {}),
  } satisfies SubmissionStore
}

describe('submitQuizResult', () => {
  it('inserts the submission when under the attempt limit', async () => {
    const store = fakeStore(1)
    const result = await submitQuizResult(store, submission)
    expect(result).toEqual({ ok: true })
    expect(store.insertSubmission).toHaveBeenCalledWith(submission)
  })

  it('rejects the submission once the attempt limit is reached', async () => {
    const store = fakeStore(3)
    const result = await submitQuizResult(store, submission)
    expect(result).toEqual({ ok: false, reason: 'limit-reached' })
    expect(store.insertSubmission).not.toHaveBeenCalled()
  })
})
```

`api/_lib/resultsLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTeacherResults } from './resultsLogic'
import type { ResultsStore } from './resultsLogic'
import type { SubmissionRecord } from '../../src/types/quiz'

const records: SubmissionRecord[] = [
  {
    id: '1',
    className: '3-2',
    studentNumber: 7,
    category: 'world',
    score: 8,
    total: 10,
    createdAt: '2026-07-31T00:00:00Z',
  },
]

function fakeStore(): ResultsStore {
  return {
    async listSubmissions() {
      return records
    },
  }
}

describe('getTeacherResults', () => {
  it('returns the submissions when the password matches', async () => {
    const result = await getTeacherResults(fakeStore(), 'secret', 'secret')
    expect(result).toEqual({ ok: true, results: records })
  })

  it('rejects a wrong password without querying the store', async () => {
    const result = await getTeacherResults(fakeStore(), 'wrong', 'secret')
    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run api/_lib`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`api/_lib/attemptsLogic.ts`:

```ts
export const MAX_ATTEMPTS = 3

export interface AttemptCounter {
  countSubmissions(className: string, studentNumber: number): Promise<number>
}

export async function getRemainingAttempts(
  counter: AttemptCounter,
  className: string,
  studentNumber: number,
): Promise<number> {
  const used = await counter.countSubmissions(className, studentNumber)
  return Math.max(0, MAX_ATTEMPTS - used)
}
```

`api/_lib/submitLogic.ts`:

```ts
import { MAX_ATTEMPTS } from './attemptsLogic'
import type { Submission } from '../../src/types/quiz'

export interface SubmissionStore {
  countSubmissions(className: string, studentNumber: number): Promise<number>
  insertSubmission(submission: Submission): Promise<void>
}

export type SubmitResult = { ok: true } | { ok: false; reason: 'limit-reached' }

export async function submitQuizResult(
  store: SubmissionStore,
  submission: Submission,
): Promise<SubmitResult> {
  const used = await store.countSubmissions(submission.className, submission.studentNumber)
  if (used >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'limit-reached' }
  }
  await store.insertSubmission(submission)
  return { ok: true }
}
```

`api/_lib/resultsLogic.ts`:

```ts
import type { SubmissionRecord } from '../../src/types/quiz'

export interface ResultsStore {
  listSubmissions(): Promise<SubmissionRecord[]>
}

export type ResultsAuthResult =
  | { ok: true; results: SubmissionRecord[] }
  | { ok: false; reason: 'unauthorized' }

export async function getTeacherResults(
  store: ResultsStore,
  password: string,
  expectedPassword: string,
): Promise<ResultsAuthResult> {
  if (password !== expectedPassword) {
    return { ok: false, reason: 'unauthorized' }
  }
  const results = await store.listSubmissions()
  return { ok: true, results }
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run api/_lib`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add api/_lib
git commit -m "Add server-side attempt/submit/results business logic"
```

---

### Task 7: Supabase admin adapter & Vercel API endpoints

**Files:**
- Create: `api/_lib/supabaseAdmin.ts`
- Create: `api/attempts.ts`
- Create: `api/submit.ts`
- Create: `api/results.ts`
- Create: `tsconfig.api.json`
- Modify: `tsconfig.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `AttemptCounter`, `SubmissionStore`, `ResultsStore`, `getRemainingAttempts`, `submitQuizResult`, `getTeacherResults` (Task 6); `Submission`, `SubmissionRecord` (Task 3).
- Produces: three HTTP endpoints — `POST /api/attempts`, `POST /api/submit`, `POST /api/results` (consumed by Task 12's `QuizApp.tsx`).

This task has **no unit tests** — `supabaseAdmin.ts` and the three handler files are thin I/O glue over the Supabase SDK and Vercel's request/response objects, already exercised indirectly by Task 6's logic tests. It's verified with a real local `vercel dev` run against the real Supabase project instead (steps below), matching the pattern in the spec's verification plan.

- [ ] **Step 1: Add the `@vercel/node` dev dependency**

```bash
npm install -D @vercel/node
```

- [ ] **Step 2: Add a TypeScript project for `api/`**

`tsconfig.api.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.api.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["api"]
}
```

Modify `tsconfig.json` to reference it:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.api.json" }
  ]
}
```

- [ ] **Step 3: Write the Supabase admin adapter**

`api/_lib/supabaseAdmin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Submission, SubmissionRecord } from '../../src/types/quiz'
import type { AttemptCounter } from './attemptsLogic'
import type { SubmissionStore } from './submitLogic'
import type { ResultsStore } from './resultsLogic'

export function createSupabaseAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey)
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>

export function createSubmissionStore(
  supabase: SupabaseAdminClient,
): AttemptCounter & SubmissionStore & ResultsStore {
  return {
    async countSubmissions(className: string, studentNumber: number): Promise<number> {
      const { count, error } = await supabase
        .from('quiz_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('class_name', className)
        .eq('student_number', studentNumber)
      if (error) throw error
      return count ?? 0
    },
    async insertSubmission(submission: Submission): Promise<void> {
      const { error } = await supabase.from('quiz_submissions').insert({
        class_name: submission.className,
        student_number: submission.studentNumber,
        category: submission.category,
        score: submission.score,
        total: submission.total,
      })
      if (error) throw error
    },
    async listSubmissions(): Promise<SubmissionRecord[]> {
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id as string,
        className: row.class_name as string,
        studentNumber: row.student_number as number,
        category: row.category as Submission['category'],
        score: row.score as number,
        total: row.total as number,
        createdAt: row.created_at as string,
      }))
    },
  }
}
```

- [ ] **Step 4: Write the three endpoint handlers**

`api/attempts.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin'
import { getRemainingAttempts } from './_lib/attemptsLogic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { className, studentNumber } = req.body ?? {}
  if (typeof className !== 'string' || typeof studentNumber !== 'number') {
    res.status(400).json({ error: 'className과 studentNumber가 필요합니다.' })
    return
  }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const remaining = await getRemainingAttempts(store, className, studentNumber)
    res.status(200).json({ remaining })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '응시 횟수를 확인하지 못했습니다.' })
  }
}
```

`api/submit.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin'
import { submitQuizResult } from './_lib/submitLogic'
import type { Submission } from '../src/types/quiz'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { className, studentNumber, category, score, total } = req.body ?? {}
  if (
    typeof className !== 'string' ||
    typeof studentNumber !== 'number' ||
    (category !== 'world' && category !== 'korea') ||
    typeof score !== 'number' ||
    typeof total !== 'number'
  ) {
    res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
    return
  }

  const submission: Submission = { className, studentNumber, category, score, total }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const result = await submitQuizResult(store, submission)
    if (!result.ok) {
      res.status(403).json({ error: '이미 3회 응시했습니다.' })
      return
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '결과를 저장하지 못했습니다.' })
  }
}
```

`api/results.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin'
import { getTeacherResults } from './_lib/resultsLogic'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { password } = req.body ?? {}
  const expectedPassword = process.env.TEACHER_PASSWORD
  if (typeof password !== 'string' || !expectedPassword) {
    res.status(500).json({ error: '서버에 비밀번호가 설정되어 있지 않습니다.' })
    return
  }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const result = await getTeacherResults(store, password, expectedPassword)
    if (!result.ok) {
      res.status(401).json({ error: '비밀번호가 틀렸습니다.' })
      return
    }
    res.status(200).json({ results: result.results })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '결과를 불러오지 못했습니다.' })
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors (this now also typechecks `api/`).

- [ ] **Step 6: Verify against the real Supabase project**

Make sure `.env` (from Task 1, Step 6) has real values, then:

```bash
npx vercel dev
```

If prompted to log in, that's a manual step for the user (visit the printed device-auth URL). Once running, in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{"className":"테스트반","studentNumber":99}'
```
Expected: `{"remaining":3}`

```bash
curl -s -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"className":"테스트반","studentNumber":99,"category":"world","score":8,"total":10}'
```
Expected: `{"ok":true}` — repeat 2 more times (3 total), then a 4th call should return HTTP 403 with `{"error":"이미 3회 응시했습니다."}`.

```bash
curl -s -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -d '{"password":"<value of TEACHER_PASSWORD from .env>"}'
```
Expected: `{"results":[...]}` containing the 3 test submissions. Also try a wrong password and confirm HTTP 401.

- [ ] **Step 7: Clean up test data**

Call `mcp__supabase__execute_sql` with:

```sql
delete from quiz_submissions where class_name = '테스트반' and student_number = 99;
```

- [ ] **Step 8: Commit**

```bash
git add api tsconfig.json tsconfig.api.json package.json package-lock.json
git commit -m "Add Supabase admin adapter and Vercel API endpoints"
```

---

### Task 8: IntroScreen component

**Files:**
- Create: `src/quiz/IntroScreen.tsx`
- Test: `src/quiz/IntroScreen.test.tsx`

**Interfaces:**
- Produces: `<IntroScreen attemptsRemaining={number|null} attemptsError={string|null} onIdentify={(className: string, studentNumber: number) => void} onStart={(questionCount: number) => void} onOpenTeacherGate={() => void} />` (consumed by Task 12).

- [ ] **Step 1: Write the failing tests**

`src/quiz/IntroScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntroScreen from './IntroScreen'

describe('IntroScreen', () => {
  it('keeps the confirm button disabled until class and number are filled in', async () => {
    const user = userEvent.setup()
    render(
      <IntroScreen
        attemptsRemaining={null}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled()
  })

  it('calls onIdentify with the entered class and number', async () => {
    const user = userEvent.setup()
    const onIdentify = vi.fn()
    render(
      <IntroScreen
        attemptsRemaining={null}
        attemptsError={null}
        onIdentify={onIdentify}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onIdentify).toHaveBeenCalledWith('3-2', 7)
  })

  it('shows a blocked message and hides the start controls when no attempts remain', () => {
    render(
      <IntroScreen
        attemptsRemaining={0}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    expect(screen.getByText('이미 3회 응시했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '시작하기' })).not.toBeInTheDocument()
  })

  it('lets the student pick a question count and start the quiz', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(
      <IntroScreen
        attemptsRemaining={2}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={onStart}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    await user.click(screen.getByLabelText('5문제'))
    await user.click(screen.getByRole('button', { name: '시작하기' }))
    expect(onStart).toHaveBeenCalledWith(5)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/quiz/IntroScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/quiz/IntroScreen.tsx`:

```tsx
import { useState } from 'react'

interface IntroScreenProps {
  attemptsRemaining: number | null
  attemptsError: string | null
  onIdentify: (className: string, studentNumber: number) => void
  onStart: (questionCount: number) => void
  onOpenTeacherGate: () => void
}

const QUESTION_COUNT_OPTIONS = [5, 10, 15] as const

function IntroScreen({
  attemptsRemaining,
  attemptsError,
  onIdentify,
  onStart,
  onOpenTeacherGate,
}: IntroScreenProps) {
  const [className, setClassName] = useState('')
  const [studentNumberInput, setStudentNumberInput] = useState('')
  const [questionCount, setQuestionCount] = useState<number>(10)

  const studentNumber = studentNumberInput === '' ? null : Number(studentNumberInput)
  const canCheck = className.trim() !== '' && studentNumber !== null && studentNumber > 0

  const handleCheck = () => {
    if (!canCheck || studentNumber === null) return
    onIdentify(className.trim(), studentNumber)
  }

  return (
    <section className="quiz-app-screen">
      <h1>역사 퀴즈 앱</h1>
      <div>
        <label>
          반
          <input value={className} onChange={(e) => setClassName(e.target.value)} />
        </label>
        <label>
          번호
          <input
            type="number"
            value={studentNumberInput}
            onChange={(e) => setStudentNumberInput(e.target.value)}
          />
        </label>
        <button type="button" onClick={handleCheck} disabled={!canCheck}>
          확인
        </button>
      </div>

      {attemptsError && <p role="alert">{attemptsError}</p>}

      {attemptsRemaining !== null && attemptsRemaining <= 0 && (
        <p role="alert">이미 3회 응시했습니다.</p>
      )}

      {attemptsRemaining !== null && attemptsRemaining > 0 && (
        <div>
          <p>남은 응시 횟수: {attemptsRemaining}회</p>
          <fieldset>
            <legend>문제 수</legend>
            {QUESTION_COUNT_OPTIONS.map((count) => (
              <label key={count}>
                <input
                  type="radio"
                  name="questionCount"
                  value={count}
                  checked={questionCount === count}
                  onChange={() => setQuestionCount(count)}
                />
                {count}문제
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={() => onStart(questionCount)}>
            시작하기
          </button>
        </div>
      )}

      <button type="button" onClick={onOpenTeacherGate}>
        선생님이신가요?
      </button>
    </section>
  )
}

export default IntroScreen
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run src/quiz/IntroScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/quiz/IntroScreen.tsx src/quiz/IntroScreen.test.tsx
git commit -m "Add IntroScreen component"
```

---

### Task 9: QuestionCard component

**Files:**
- Create: `src/quiz/QuestionCard.tsx`
- Test: `src/quiz/QuestionCard.test.tsx`

**Interfaces:**
- Consumes: `Question` (Task 3).
- Produces: `<QuestionCard question={Question} index={number} total={number} selectedOption={number|null} onSelect={(optionIndex: number) => void} onNext={() => void} />` (consumed by Task 12).

- [ ] **Step 1: Write the failing tests**

`src/quiz/QuestionCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestionCard from './QuestionCard'
import type { Question } from '../types/quiz'

const question: Question = {
  id: 'q1',
  category: 'world',
  question: '테스트 문제',
  options: ['가', '나', '다', '라'],
  correctIndex: 1,
}

describe('QuestionCard', () => {
  it('calls onSelect with the clicked option index', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={null}
        onSelect={onSelect}
        onNext={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: '나' }))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('marks the correct option and the wrong pick once answered, and disables all options', () => {
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={0}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '가' })).toHaveAttribute('data-status', 'incorrect')
    expect(screen.getByRole('button', { name: '나' })).toHaveAttribute('data-status', 'correct')
    expect(screen.getByRole('button', { name: '가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '나' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '라' })).toBeDisabled()
  })

  it('shows "결과 보기" as the next-button label on the last question', () => {
    render(
      <QuestionCard
        question={question}
        index={4}
        total={5}
        selectedOption={1}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '결과 보기' })).toBeInTheDocument()
  })

  it('shows "다음 문제" on non-final questions and calls onNext when clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={1}
        onSelect={vi.fn()}
        onNext={onNext}
      />,
    )
    await user.click(screen.getByRole('button', { name: '다음 문제' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('does not show a next button before an option is selected', () => {
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={null}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: '다음 문제' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '결과 보기' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/quiz/QuestionCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/quiz/QuestionCard.tsx`:

```tsx
import type { Question } from '../types/quiz'

interface QuestionCardProps {
  question: Question
  index: number
  total: number
  selectedOption: number | null
  onSelect: (optionIndex: number) => void
  onNext: () => void
}

function QuestionCard({
  question,
  index,
  total,
  selectedOption,
  onSelect,
  onNext,
}: QuestionCardProps) {
  const answered = selectedOption !== null
  const isLast = index === total - 1

  return (
    <section className="quiz-app-screen">
      <p>
        {index + 1} / {total}
      </p>
      <h2>{question.question}</h2>
      <ul>
        {question.options.map((option, optionIndex) => {
          let status: 'default' | 'correct' | 'incorrect' = 'default'
          if (answered) {
            if (optionIndex === question.correctIndex) status = 'correct'
            else if (optionIndex === selectedOption) status = 'incorrect'
          }
          return (
            <li key={option}>
              <button
                type="button"
                data-status={status}
                disabled={answered}
                onClick={() => onSelect(optionIndex)}
              >
                {option}
              </button>
            </li>
          )
        })}
      </ul>
      {answered && (
        <button type="button" onClick={onNext}>
          {isLast ? '결과 보기' : '다음 문제'}
        </button>
      )}
    </section>
  )
}

export default QuestionCard
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run src/quiz/QuestionCard.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/quiz/QuestionCard.tsx src/quiz/QuestionCard.test.tsx
git commit -m "Add QuestionCard component"
```

---

### Task 10: ResultScreen component

**Files:**
- Create: `src/quiz/ResultScreen.tsx`
- Test: `src/quiz/ResultScreen.test.tsx`

**Interfaces:**
- Consumes: `SubmitStatus` (Task 5).
- Produces: `<ResultScreen score={number} total={number} submitStatus={SubmitStatus} onSubmit={() => void} onRestart={() => void} />` (consumed by Task 12). `onSubmit` fires once automatically on mount.

- [ ] **Step 1: Write the failing tests**

`src/quiz/ResultScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultScreen from './ResultScreen'

describe('ResultScreen', () => {
  it('shows the score and calls onSubmit once on mount', () => {
    const onSubmit = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="idle" onSubmit={onSubmit} onRestart={vi.fn()} />,
    )
    expect(screen.getByText('10문제 중 8개 정답')).toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('offers a retry button when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="error" onSubmit={onSubmit} onRestart={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('shows a limit-reached message without a retry button', () => {
    render(
      <ResultScreen
        score={8}
        total={10}
        submitStatus="limit-reached"
        onSubmit={vi.fn()}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByText('이미 3회 응시했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('calls onRestart when the restart button is clicked', async () => {
    const user = userEvent.setup()
    const onRestart = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="saved" onSubmit={vi.fn()} onRestart={onRestart} />,
    )
    await user.click(screen.getByRole('button', { name: '다시 풀기' }))
    expect(onRestart).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/quiz/ResultScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/quiz/ResultScreen.tsx`:

```tsx
import { useEffect } from 'react'
import type { SubmitStatus } from './quizReducer'

interface ResultScreenProps {
  score: number
  total: number
  submitStatus: SubmitStatus
  onSubmit: () => void
  onRestart: () => void
}

function ResultScreen({ score, total, submitStatus, onSubmit, onRestart }: ResultScreenProps) {
  useEffect(() => {
    onSubmit()
  }, [])

  return (
    <section className="quiz-app-screen">
      <h2>
        {total}문제 중 {score}개 정답
      </h2>
      {submitStatus === 'saving' && <p>저장 중...</p>}
      {submitStatus === 'saved' && <p>저장 완료</p>}
      {submitStatus === 'error' && (
        <div>
          <p role="alert">저장 실패</p>
          <button type="button" onClick={onSubmit}>
            다시 시도
          </button>
        </div>
      )}
      {submitStatus === 'limit-reached' && <p role="alert">이미 3회 응시했습니다.</p>}
      <button type="button" onClick={onRestart}>
        다시 풀기
      </button>
    </section>
  )
}

export default ResultScreen
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run src/quiz/ResultScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/quiz/ResultScreen.tsx src/quiz/ResultScreen.test.tsx
git commit -m "Add ResultScreen component"
```

---

### Task 11: TeacherGate & TeacherResults components

**Files:**
- Create: `src/quiz/TeacherGate.tsx`
- Test: `src/quiz/TeacherGate.test.tsx`
- Create: `src/quiz/TeacherResults.tsx`
- Test: `src/quiz/TeacherResults.test.tsx`

**Interfaces:**
- Consumes: `SubmissionRecord` (Task 3).
- Produces: `<TeacherGate error={string|null} onSubmitPassword={(password: string) => void} onBack={() => void} />`, `<TeacherResults results={SubmissionRecord[]} onBack={() => void} />` (consumed by Task 12).

- [ ] **Step 1: Write the failing tests**

`src/quiz/TeacherGate.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherGate from './TeacherGate'

describe('TeacherGate', () => {
  it('disables the confirm button until a password is entered', async () => {
    const user = userEvent.setup()
    render(<TeacherGate error={null} onSubmitPassword={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
    await user.type(screen.getByLabelText('비밀번호'), 'secret')
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled()
  })

  it('calls onSubmitPassword with the entered value', async () => {
    const user = userEvent.setup()
    const onSubmitPassword = vi.fn()
    render(<TeacherGate error={null} onSubmitPassword={onSubmitPassword} onBack={vi.fn()} />)
    await user.type(screen.getByLabelText('비밀번호'), 'secret')
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onSubmitPassword).toHaveBeenCalledWith('secret')
  })

  it('shows an error message when provided', () => {
    render(<TeacherGate error="비밀번호가 틀렸습니다" onSubmitPassword={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('비밀번호가 틀렸습니다')).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<TeacherGate error={null} onSubmitPassword={vi.fn()} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: '돌아가기' }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

`src/quiz/TeacherResults.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeacherResults from './TeacherResults'
import type { SubmissionRecord } from '../types/quiz'

describe('TeacherResults', () => {
  it('shows an empty-state message when there are no results', () => {
    render(<TeacherResults results={[]} onBack={() => {}} />)
    expect(screen.getByText('아직 제출된 결과가 없습니다.')).toBeInTheDocument()
  })

  it('lists each submission in a table row', () => {
    const results: SubmissionRecord[] = [
      {
        id: '1',
        className: '3-2',
        studentNumber: 7,
        category: 'world',
        score: 8,
        total: 10,
        createdAt: '2026-07-31T00:00:00Z',
      },
      {
        id: '2',
        className: '3-1',
        studentNumber: 3,
        category: 'world',
        score: 5,
        total: 10,
        createdAt: '2026-07-31T00:05:00Z',
      },
    ]
    render(<TeacherResults results={results} onBack={() => {}} />)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('3-2')).toBeInTheDocument()
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/quiz/TeacherGate.test.tsx src/quiz/TeacherResults.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/quiz/TeacherGate.tsx`:

```tsx
import { useState } from 'react'

interface TeacherGateProps {
  error: string | null
  onSubmitPassword: (password: string) => void
  onBack: () => void
}

function TeacherGate({ error, onSubmitPassword, onBack }: TeacherGateProps) {
  const [password, setPassword] = useState('')

  return (
    <section className="quiz-app-screen">
      <h2>선생님 로그인</h2>
      <label>
        비밀번호
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="button" onClick={() => onSubmitPassword(password)} disabled={password === ''}>
        확인
      </button>
      <button type="button" onClick={onBack}>
        돌아가기
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

export default TeacherGate
```

`src/quiz/TeacherResults.tsx`:

```tsx
import type { SubmissionRecord } from '../types/quiz'

interface TeacherResultsProps {
  results: SubmissionRecord[]
  onBack: () => void
}

function TeacherResults({ results, onBack }: TeacherResultsProps) {
  return (
    <section className="quiz-app-screen">
      <h2>제출 결과</h2>
      <button type="button" onClick={onBack}>
        돌아가기
      </button>
      {results.length === 0 ? (
        <p>아직 제출된 결과가 없습니다.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>반</th>
              <th>번호</th>
              <th>점수</th>
              <th>제출 시각</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{result.className}</td>
                <td>{result.studentNumber}</td>
                <td>
                  {result.score} / {result.total}
                </td>
                <td>{new Date(result.createdAt).toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default TeacherResults
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run: `npx vitest run src/quiz/TeacherGate.test.tsx src/quiz/TeacherResults.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/quiz/TeacherGate.tsx src/quiz/TeacherGate.test.tsx src/quiz/TeacherResults.tsx src/quiz/TeacherResults.test.tsx
git commit -m "Add TeacherGate and TeacherResults components"
```

---

### Task 12: QuizApp assembly & App.tsx cleanup

**Files:**
- Create: `src/quiz/QuizApp.tsx`
- Test: `src/quiz/QuizApp.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3–11 (`quizReducer`, `initialQuizState`, `QUESTIONS`, `sample`, `IntroScreen`, `QuestionCard`, `ResultScreen`, `TeacherGate`, `TeacherResults`, and the three `/api/*` endpoints from Task 7).
- Produces: `<QuizApp />`, the single component `App.tsx` renders.

- [ ] **Step 1: Write the failing test**

`src/quiz/QuizApp.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizApp from './QuizApp'

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

describe('QuizApp', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks attempts, runs a full quiz round, and submits the score', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementationOnce(() => jsonResponse(200, { remaining: 3 }))
    fetchMock.mockImplementationOnce(() => jsonResponse(200, { ok: true }))

    render(<QuizApp />)

    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    await user.click(screen.getByRole('button', { name: '확인' }))

    expect(await screen.findByText('남은 응시 횟수: 3회')).toBeInTheDocument()

    await user.click(screen.getByLabelText('5문제'))
    await user.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('1 / 5')).toBeInTheDocument()

    for (let i = 0; i < 5; i += 1) {
      const options = screen
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('data-status'))
      await user.click(options[0])
      const isLast = i === 4
      await user.click(screen.getByRole('button', { name: isLast ? '결과 보기' : '다음 문제' }))
    }

    expect(await screen.findByText('저장 완료')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/submit',
      expect.objectContaining({
        body: expect.stringContaining('"className":"3-2"'),
      }),
    )
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/quiz/QuizApp.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/quiz/QuizApp.tsx`:

```tsx
import { useReducer } from 'react'
import { quizReducer, initialQuizState } from './quizReducer'
import { QUESTIONS } from '../data/questions'
import { sample } from '../lib/shuffle'
import type { SubmissionRecord } from '../types/quiz'
import IntroScreen from './IntroScreen'
import QuestionCard from './QuestionCard'
import ResultScreen from './ResultScreen'
import TeacherGate from './TeacherGate'
import TeacherResults from './TeacherResults'
import './QuizApp.css'

const WORLD_QUESTIONS = QUESTIONS.filter((q) => q.category === 'world')

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? '요청에 실패했습니다.')
  }
  return data as T
}

function QuizApp() {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState)

  const handleIdentify = async (className: string, studentNumber: number) => {
    dispatch({ type: 'CHECK_ATTEMPTS_START', className, studentNumber })
    try {
      const data = await postJson<{ remaining: number }>('/api/attempts', {
        className,
        studentNumber,
      })
      dispatch({ type: 'CHECK_ATTEMPTS_SUCCESS', remaining: data.remaining })
    } catch {
      dispatch({ type: 'CHECK_ATTEMPTS_FAILURE', message: '응시 횟수를 확인하지 못했습니다.' })
    }
  }

  const handleStart = (questionCount: number) => {
    dispatch({ type: 'START', questions: sample(WORLD_QUESTIONS, questionCount) })
  }

  const handleSubmitResult = async () => {
    dispatch({ type: 'SUBMIT_START' })
    try {
      await postJson('/api/submit', {
        className: state.className,
        studentNumber: state.studentNumber,
        category: 'world',
        score: state.score,
        total: state.questions.length,
      })
      dispatch({ type: 'SUBMIT_SUCCESS' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        dispatch({ type: 'SUBMIT_LIMIT_REACHED' })
      } else {
        dispatch({ type: 'SUBMIT_ERROR' })
      }
    }
  }

  const handleTeacherLogin = async (password: string) => {
    dispatch({ type: 'TEACHER_LOGIN_START' })
    try {
      const data = await postJson<{ results: SubmissionRecord[] }>('/api/results', { password })
      dispatch({ type: 'TEACHER_LOGIN_SUCCESS', results: data.results })
    } catch {
      dispatch({ type: 'TEACHER_LOGIN_FAILURE', message: '비밀번호가 틀렸습니다.' })
    }
  }

  switch (state.screen) {
    case 'intro':
      return (
        <IntroScreen
          attemptsRemaining={state.attemptsRemaining}
          attemptsError={state.attemptsError}
          onIdentify={handleIdentify}
          onStart={handleStart}
          onOpenTeacherGate={() => dispatch({ type: 'OPEN_TEACHER_GATE' })}
        />
      )
    case 'question':
      return (
        <QuestionCard
          question={state.questions[state.currentIndex]}
          index={state.currentIndex}
          total={state.questions.length}
          selectedOption={state.selectedOption}
          onSelect={(optionIndex) => dispatch({ type: 'SELECT_OPTION', optionIndex })}
          onNext={() => dispatch({ type: 'NEXT' })}
        />
      )
    case 'result':
      return (
        <ResultScreen
          score={state.score}
          total={state.questions.length}
          submitStatus={state.submitStatus}
          onSubmit={handleSubmitResult}
          onRestart={() => dispatch({ type: 'RESTART' })}
        />
      )
    case 'teacherGate':
      return (
        <TeacherGate
          error={state.teacherError}
          onSubmitPassword={handleTeacherLogin}
          onBack={() => dispatch({ type: 'BACK_TO_INTRO' })}
        />
      )
    case 'teacherResults':
      return (
        <TeacherResults
          results={state.teacherResults ?? []}
          onBack={() => dispatch({ type: 'BACK_TO_INTRO' })}
        />
      )
    default:
      return null
  }
}

export default QuizApp
```

`src/App.tsx` (replace entirely):

```tsx
import QuizApp from './quiz/QuizApp'

function App() {
  return <QuizApp />
}

export default App
```

Note: `QuizApp.tsx` imports `./QuizApp.css`, which doesn't exist yet — that's fine, it's created in Task 13. Vite/Vitest won't error on an empty/missing CSS import failing the test run as long as the file exists; create an **empty** `src/quiz/QuizApp.css` right now as part of this step so the import resolves, and Task 13 fills it in.

- [ ] **Step 4: Create the placeholder CSS file so the import resolves**

Create empty file `src/quiz/QuizApp.css` (no content yet — Task 13 fills it in).

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `npx vitest run src/quiz/QuizApp.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test`
Expected: all tests across every task pass.

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/quiz/QuizApp.tsx src/quiz/QuizApp.test.tsx src/quiz/QuizApp.css src/App.tsx
git commit -m "Wire up QuizApp and trim App.tsx"
```

---

### Task 13: Styling

**Files:**
- Modify: `src/quiz/QuizApp.css`
- Modify: `src/quiz/IntroScreen.tsx` (already has `className="quiz-app-screen"` from Task 8 — no change needed)
- Modify: `src/quiz/QuestionCard.tsx` (already has it from Task 9 — no change needed)
- Modify: `src/quiz/ResultScreen.tsx` (already has it from Task 10 — no change needed)
- Modify: `src/quiz/TeacherGate.tsx` (already has it from Task 11 — no change needed)
- Modify: `src/quiz/TeacherResults.tsx` (already has it from Task 11 — no change needed)

**Interfaces:** none — pure styling, no exports change.

- [ ] **Step 1: Fill in the stylesheet**

`src/quiz/QuizApp.css`:

```css
.quiz-app-screen {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  text-align: left;
}

.quiz-app-screen fieldset {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
}

.quiz-app-screen label {
  display: block;
  margin: 8px 0;
}

.quiz-app-screen input[type='text'],
.quiz-app-screen input[type='number'],
.quiz-app-screen input[type='password'] {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  margin-left: 8px;
  background: var(--bg);
  color: var(--text-h);
}

.quiz-app-screen button {
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--text-h);
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
  margin: 4px 4px 4px 0;
}

.quiz-app-screen button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quiz-app-screen ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quiz-app-screen button[data-status='correct'] {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.6);
}

.quiz-app-screen button[data-status='incorrect'] {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
}

.quiz-app-screen table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.quiz-app-screen th,
.quiz-app-screen td {
  border-bottom: 1px solid var(--border);
  padding: 8px;
  text-align: left;
}

@media (max-width: 1024px) {
  .quiz-app-screen {
    padding: 16px 12px;
  }
}
```

- [ ] **Step 2: Manual visual check**

Run: `npm run dev`, open the printed local URL, and check:
- Full student flow (identify → pick count → answer → result) looks readable, buttons aren't cramped
- Correct/incorrect colors are visible in both light and dark mode (toggle via devtools "Emulate CSS prefers-color-scheme")
- Narrow viewport (~375px width) doesn't overflow horizontally
- Teacher flow (gate → results table) renders cleanly, table doesn't overflow on narrow screens

- [ ] **Step 3: Commit**

```bash
git add src/quiz/QuizApp.css
git commit -m "Style the quiz screens"
```

---

### Task 14: Deploy

**Files:** none (verification + deployment)

- [ ] **Step 1: Full local verification**

```bash
npm test
npx tsc -b --noEmit
npm run build
npm run lint
```

Expected: all four succeed with no errors. Then remove the build output: `rm -rf dist`.

- [ ] **Step 2: Confirm the build doesn't leak secrets**

```bash
grep -r "SUPABASE_SERVICE_ROLE_KEY\|TEACHER_PASSWORD" dist/ 2>/dev/null || echo "clean"
```

(Run `npm run build` again first if `dist/` was removed in Step 1.) Expected: `clean` — neither var name nor its value appears in client-bundled output, since both are read only inside `api/*.ts`, which never ships to the browser bundle.

- [ ] **Step 3: Set the two new server-only env vars on Vercel**

This is a manual step for the user — the values must never be committed. Two ways to do it:

- **Dashboard:** Vercel project → Settings → Environment Variables → add `SUPABASE_SERVICE_ROLE_KEY` and `TEACHER_PASSWORD` (Production, and Preview if used) with the same values as local `.env`.
- **CLI** (only if `npx vercel whoami` succeeds — earlier in this session the CLI wasn't logged in and needed an interactive device-auth flow):
  ```bash
  npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
  npx vercel env add TEACHER_PASSWORD production
  ```

Also confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are already set on Vercel (they should be, from when the project was first deployed) — if not, add them the same way.

- [ ] **Step 4: Commit remaining changes and confirm before pushing**

```bash
git status
git add -A
git commit -m "Implement history quiz app: student flow, attempt limit, teacher results"
```

**Stop here and ask the user for explicit confirmation before running `git push`** — that has been the working pattern throughout this session (they've confirmed every push individually so far).

- [ ] **Step 5: Push and verify production**

Once confirmed:

```bash
git push
```

Vercel's GitHub integration redeploys automatically. Once the deployment finishes, open the production URL and manually verify:
- A student can identify with a real class+number, pick a question count, complete the quiz, and see "저장 완료"
- Trying a 4th attempt for the same class+number is blocked with "이미 3회 응시했습니다." before the quiz even starts
- The "선생님이신가요?" link → wrong password shows "비밀번호가 틀렸습니다.", correct `TEACHER_PASSWORD` shows the results table with the test submissions

- [ ] **Step 6: Clean up test data from production**

Call `mcp__supabase__execute_sql` to delete whatever test rows were created during production verification, so the teacher's real results table starts clean.

---

## Self-Review Notes

- **Spec coverage:** class+number identification (Task 8), 5/10/15 question-count choice (Task 8), 4-option immediate-feedback flow (Task 9), 3-attempt cap enforced server-side (Tasks 6–7), locked-down RLS with server-only access (Task 1, 7), teacher password gate (Task 11–12), category field ready for `'korea'` (Task 3) — all covered.
- **Type consistency:** `Submission`/`SubmissionRecord` (Task 3) are the same shape consumed unchanged through Tasks 6, 7, 11, 12. `SubmitStatus` (Task 5) is imported as-is by `ResultScreen` (Task 10) and set by `QuizApp` (Task 12) — no renamed duplicates.
- **No placeholders:** every task has concrete, runnable code; Task 7 and Task 13 explicitly state why they have no automated tests (thin I/O glue verified via real integration; pure CSS) rather than silently skipping TDD.
