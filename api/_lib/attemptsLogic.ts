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
