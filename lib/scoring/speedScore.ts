/**
 * Speed-weighted scoring: correct + fast = max points, correct + slow = min points, wrong = 0.
 * All timing derived from server DB timestamps, never client payload.
 */
export function calculateSpeedScore(
  isCorrect: boolean,
  timeToAnswerMs: number,
  timeLimitMs: number,
  maxPoints = 1000
): number {
  if (!isCorrect) return 0;
  const MIN_POINTS = Math.floor(maxPoints * 0.2);
  const speedRatio = Math.max(0, 1 - timeToAnswerMs / timeLimitMs);
  return MIN_POINTS + Math.floor((maxPoints - MIN_POINTS) * speedRatio);
}
