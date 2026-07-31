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
