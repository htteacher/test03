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
