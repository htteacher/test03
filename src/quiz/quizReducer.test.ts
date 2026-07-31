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
