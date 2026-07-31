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
