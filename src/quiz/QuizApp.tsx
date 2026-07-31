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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        dispatch({ type: 'TEACHER_LOGIN_FAILURE', message: '비밀번호가 틀렸습니다.' })
      } else {
        dispatch({
          type: 'TEACHER_LOGIN_FAILURE',
          message: error instanceof Error ? error.message : '결과를 불러오지 못했습니다.',
        })
      }
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
