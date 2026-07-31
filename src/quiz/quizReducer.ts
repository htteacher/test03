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
