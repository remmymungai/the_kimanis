const POINTS_PER_CORRECT = 500;

type AnswerRow = { guest_id: string; is_correct: boolean };
type ScoredRow = { guest_id: string; points: number };

export function scoreFindTheGuest(answers: AnswerRow[]): ScoredRow[] {
  return answers.map((a) => ({
    guest_id: a.guest_id,
    points: a.is_correct ? POINTS_PER_CORRECT : 0,
  }));
}
