"use client";

import { useState, useCallback } from "react";
import { QuestionPrompt } from "@/components/shared/QuestionPrompt";
import { CountdownTimer } from "@/components/shared/CountdownTimer";
import { AnswerSubmitted } from "@/components/shared/AnswerSubmitted";
import { Leaderboard } from "@/components/shared/Leaderboard";
import { WaitingLobby } from "@/components/shared/WaitingLobby";
import { cn, formatKES } from "@/lib/utils";
import type { GameUIState } from "@/hooks/useGameState";

type Props = {
  uiState: GameUIState;
  guestId: string;
  gameInstanceId: string;
  onAnswer: (answer: string) => void;
};

export function PriceIsRightGame({ uiState, guestId, gameInstanceId, onAnswer }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (uiState.phase !== "question" || !amount) return;
    const numeric = parseInt(amount.replace(/,/g, ""), 10);
    if (isNaN(numeric) || numeric <= 0) return;

    setLoading(true);
    await fetch("/api/play/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: uiState.question.id,
        game_instance_id: gameInstanceId,
        guest_id: guestId,
        raw_answer: String(numeric),
      }),
    });
    onAnswer(formatKES(numeric));
    setLoading(false);
  }, [uiState, guestId, gameInstanceId, amount, onAnswer]);

  if (uiState.phase === "waiting") return <WaitingLobby />;

  if (uiState.phase === "question") {
    const { question, closesAt } = uiState;

    return (
      <div className="flex flex-col min-h-dvh bg-cream pb-safe">
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-olive/70">
            The Price Is Right
          </span>
          {closesAt && <CountdownTimer closesAt={closesAt} />}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <QuestionPrompt
            prompt={question.prompt}
            questionNumber={question.index + 1}
            totalQuestions={question.total_questions || undefined}
          />

          {/* KES input */}
          <div className="w-full max-w-xs">
            <label className="text-xs font-semibold uppercase tracking-widest text-olive/70 block text-center mb-3">
              Your guess (KES)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                KES
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-14 pr-4 py-4 rounded-xl border-2 border-border bg-white text-dark
                           text-2xl font-bold text-right tabular-nums
                           focus:outline-none focus:border-olive transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="px-5 pb-6">
          <button
            onClick={handleSubmit}
            disabled={loading || !amount || parseInt(amount, 10) <= 0}
            className={cn(
              "w-full py-4 rounded-xl bg-gold text-dark font-bold text-base",
              "active:scale-95 transition-all duration-100",
              "disabled:opacity-40 shadow-md shadow-gold/20"
            )}
          >
            {loading ? "Submitting..." : "Lock In My Answer →"}
          </button>
        </div>
      </div>
    );
  }

  if (uiState.phase === "answer_submitted") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center">
        <AnswerSubmitted answer={uiState.answer} />
        {uiState.closesAt && <CountdownTimer closesAt={uiState.closesAt} size={56} />}
      </div>
    );
  }

  if (uiState.phase === "result") {
    const correctValue = uiState.correctValue;
    return (
      <div className="min-h-dvh bg-cream flex flex-col overflow-y-auto pb-safe pt-safe">
        <div className="px-4 pt-6 pb-4 text-center">
          {correctValue !== undefined && (
            <p className="text-base font-medium text-muted-foreground">
              The answer was{" "}
              <span className="text-2xl font-bold text-olive">{formatKES(correctValue)}</span>
            </p>
          )}
        </div>
        {uiState.top10.length > 0 && (
          <div className="px-4 pb-8">
            <Leaderboard entries={uiState.top10} highlightGuestId={guestId} />
          </div>
        )}
      </div>
    );
  }

  if (uiState.phase === "completed") {
    return (
      <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-6 px-4 pb-safe pt-safe">
        <div className="text-5xl">💰</div>
        <h2 className="text-2xl font-bold text-dark text-center">Game Over!</h2>
        <Leaderboard entries={uiState.finalLeaderboard} highlightGuestId={guestId} title="Final Scores" />
      </div>
    );
  }

  return null;
}
