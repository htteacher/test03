import { useEffect, useRef } from 'react'
import type { SubmitStatus } from './quizReducer'

interface ResultScreenProps {
  score: number
  total: number
  submitStatus: SubmitStatus
  onSubmit: () => void
  onRestart: () => void
}

function ResultScreen({ score, total, submitStatus, onSubmit, onRestart }: ResultScreenProps) {
  const submitted = useRef(false)

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
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
