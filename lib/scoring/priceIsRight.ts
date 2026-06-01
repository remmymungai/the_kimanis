type AnswerRow = { guest_id: string; raw_answer: string };
type ScoredRow = { guest_id: string; points: number };

export function scorePriceIsRight(
  answers: AnswerRow[],
  correctValue: number,
  maxPoints = 1000
): ScoredRow[] {
  const parsed = answers.map((a) => ({
    guest_id: a.guest_id,
    guess: parseInt(a.raw_answer, 10),
    diff: Math.abs(parseInt(a.raw_answer, 10) - correctValue),
  }));

  const minDiff = Math.min(...parsed.map((a) => a.diff));

  return parsed.map((a) => ({
    guest_id: a.guest_id,
    points:
      a.diff === minDiff
        ? maxPoints
        : Math.max(0, maxPoints - Math.floor((a.diff / correctValue) * maxPoints)),
  }));
}
