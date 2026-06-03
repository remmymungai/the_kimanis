type AnswerRow = { guest_id: string; raw_answer: string };
type ScoredRow = { guest_id: string; points: number; is_correct: boolean };

/**
 * Accuracy-based scoring: the closer your guess, the more points.
 * points = maxPoints * (1 - |guess - correct| / correct), floored at 0.
 * A perfect guess scores max; a guess 100%+ off scores 0. The closest guess
 * naturally earns the most — no flat "closest takes all" that rewarded wild guesses.
 */
export function scorePriceIsRight(
  answers: AnswerRow[],
  correctValue: number,
  maxPoints = 1000
): ScoredRow[] {
  const safeCorrect = correctValue === 0 ? 1 : Math.abs(correctValue);
  return answers.map((a) => {
    const guess = parseFloat(a.raw_answer);
    if (isNaN(guess)) return { guest_id: a.guest_id, points: 0, is_correct: false };
    const diff = Math.abs(guess - correctValue);
    const accuracy = Math.max(0, 1 - diff / safeCorrect);
    return {
      guest_id: a.guest_id,
      points: Math.round(maxPoints * accuracy),
      is_correct: diff === 0,
    };
  });
}
