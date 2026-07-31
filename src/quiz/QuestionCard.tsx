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
